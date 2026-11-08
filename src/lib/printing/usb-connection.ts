import { NiimbotAbstractClient, ConnectEvent, DisconnectEvent, RawPacketSentEvent, ConnectResult } from "@mmote/niimbluelib";
import type { ConnectionInfo, NiimbotClientType } from "@mmote/niimbluelib";

export function usbError(error: unknown): string {
  const name = error instanceof Error ? error.name : "";
  const message = error instanceof Error ? error.message : String(error);
  if (name === "NotFoundError") return "Pemilihan port dibatalkan atau perangkat USB serial tidak ditemukan. Pastikan kabel data, printer menyala, dan port COM muncul di Device Manager.";
  if (name === "SecurityError" || name === "NotAllowedError") return "Izin USB ditolak. Gunakan HTTPS/localhost dan izinkan akses serial melalui tombol Hubungkan USB.";
  if (name === "NetworkError" || name === "InvalidStateError") return `Port tidak dapat dibuka atau sedang dipakai aplikasi/tab lain. Tutup aplikasi NIIMBOT lalu hubungkan lagi. ${message}`;
  return message;
}

/** USB transport only. Owns the read loop so close cancels the pending read first. */
export class UsbSerialConnection extends NiimbotAbstractClient {
  private port?: SerialPort;
  private reader?: ReadableStreamDefaultReader<Uint8Array>;
  private writer?: WritableStreamDefaultWriter<Uint8Array>;
  private readLoop?: Promise<void>;
  private closing = false;
  private selected?: SerialPort;
  private removed = () => { void this.disconnect(); };
  constructor(port: SerialPort) {
    super(); this.selected = port;
    this.setHeartbeatAutoStart(false);
    this.setFetchRfidOnPrintEnd(false);
  }
  override async connect(): Promise<ConnectionInfo> {
    const port = this.selected;
    if (!port) throw new Error("Pilih port USB lagi melalui Hubungkan USB.");
    const info = port.getInfo();
    if (info.usbVendorId === undefined || info.usbProductId === undefined) {
      throw new Error("Port ini tidak memiliki identitas USB VID/PID. Hanya USB yang diizinkan.");
    }
    await port.open({ baudRate: 115200 });
    this.port = port;
    port.addEventListener("disconnect", this.removed);
    try {
      if (!port.readable || !port.writable) throw new Error("Port USB tidak dapat dibaca/ditulis.");
      this.reader = port.readable.getReader(); this.writer = port.writable.getWriter();
      this.closing = false;
      this.readLoop = this.readPackets();
      await this.connectNegotiate();
      if (![ConnectResult.Connected, ConnectResult.ConnectedNew, ConnectResult.ConnectedV3].includes(this.getPrinterInfo().connectResult!)) {
        throw new Error(`Negosiasi printer ditolak: ${this.getPrinterInfo().connectResult}`);
      }
      await this.fetchPrinterInfo();
      const result = { deviceName: `USB VID:${info.usbVendorId.toString(16)} PID:${info.usbProductId.toString(16)}`, result: this.getPrinterInfo().connectResult! };
      this.emit("connect", new ConnectEvent(result));
      return result;
    } catch (error) { await this.disconnect(); throw error; }
  }
  override async fetchPrinterInfo() {
    const info = this.printerInfo;
    info.modelId = await this.protocol.getPrinterModel();
    info.serial = await this.protocol.getPrinterSerialNumber().catch(() => undefined);
    info.softwareVersion = await this.protocol.getSoftwareVersion().catch(() => undefined);
    try {
      const heartbeat = await this.protocol.heartbeatPrinterInfo();
      info.printheadWidth = heartbeat.printheadWidth;
      info.resolutionClass = heartbeat.resolutionClass;
      info.hardwareVersion = heartbeat.hardwareVersion;
      info.softwareVersion = heartbeat.softwareVersion;
    } catch { /* Older D110 firmware: use sourced model geometry after validation. */ }
    return info;
  }
  private async readPackets() {
    try {
      while (!this.closing && this.reader) {
        const { value, done } = await this.reader.read();
        if (done) break;
        if (value) this.processRawPacket(value);
      }
    } catch { /* A lost stream is reported as a disconnect below. */ }
    finally {
      this.reader?.releaseLock(); this.reader = undefined;
      if (!this.closing) {
        // Do not await the read loop from inside itself.
        setTimeout(() => { void this.disconnect(); }, 0);
      }
    }
  }
  override async disconnect() {
    if (this.closing) return;
    this.closing = true;
    this.stopHeartbeat();
    const port = this.port;
    port?.removeEventListener("disconnect", this.removed);
    await this.reader?.cancel().catch(() => undefined);
    await this.readLoop;
    if (this.writer) {
      await this.writer.abort().catch(() => undefined);
      this.writer.releaseLock(); this.writer = undefined;
    }
    await port?.close().catch(() => undefined);
    this.port = undefined; this.selected = undefined;
    this.emit("disconnect", new DisconnectEvent());
  }
  override isConnected() { return !!this.port && !!this.writer && !!this.reader && !this.closing; }
  override getType(): NiimbotClientType { return "serial"; }
  override async sendRaw(data: Uint8Array, force?: boolean) {
    const send = async () => {
      await new Promise(resolve => setTimeout(resolve, this.packetIntervalMs));
      if (!this.isConnected()) throw new Error("USB terputus atau printer mati.");
      let timer: ReturnType<typeof setTimeout> | undefined;
      try {
        await Promise.race([
          this.writer!.write(data),
          new Promise<never>((_, reject) => { timer = setTimeout(() => reject(new Error("Batas waktu pengiriman USB habis; hasil cetak mungkin belum diketahui.")), 2000); }),
        ]);
      } catch (error) {
        void this.disconnect();
        throw error;
      } finally { clearTimeout(timer); }
      this.emit("rawpacketsent", new RawPacketSentEvent(data));
    };
    if (force) await send(); else await this.mutex.runExclusive(send);
  }
}
