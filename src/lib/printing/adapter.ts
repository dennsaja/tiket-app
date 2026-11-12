import { ConnectResult, ImageEncoder, NiimbotBluetoothClient, PacketGenerator, PageColorType, ResolutionClass } from "@mmote/niimbluelib";
import type { NiimbotPacket, PrinterInfo } from "@mmote/niimbluelib";
import { UsbSerialConnection } from "./usb-connection";
import type { LabelProfile, PaperReading, PrinterIdentity } from "./types";
import { paperReading } from "./paper";
import { sendWithReply } from "./reply";

const GEOMETRY_SOURCE = "@mmote/niimbluelib 0.49.1 printer_models.ts; https://printers.niim.blue/hardware/models/";
export function identifyPrinter(info: PrinterInfo): PrinterIdentity {
  if (info.modelId === 2305 && info.printheadWidth !== 96) throw new Error("Model 2305 memerlukan konfirmasi kepala cetak 96 titik dari perangkat.");
  const model = info.modelId === 2304 || info.modelId === 2305 ? "D110" : info.modelId === 2320 ? "D110_M" : undefined;
  if (!model) throw new Error(`Printer tidak didukung (model ID ${info.modelId ?? "tidak tersedia"}). Hanya D110 2304 dan D110_M 2320.`);
  // D110 2304 can return a short status reply without version bytes.
  const protocol = info.protocolVersion ?? 0;
  if (!(info.modelId === 2304 && protocol === 0) && ![1, 2, 3, 4].includes(protocol)) throw new Error(`Versi protokol ${protocol} belum didukung.`);
  if (info.resolutionClass !== undefined && info.resolutionClass !== ResolutionClass.DPI203) throw new Error("DPI respons printer berbeda dengan profil 203 DPI yang diverifikasi; cetak diblokir.");
  if (info.printheadWidth !== undefined && info.printheadWidth !== 96) throw new Error(`Kepala cetak ${info.printheadWidth}px berbeda dari profil 96px; cetak diblokir.`);
  return {
    model, modelId: info.modelId!, firmware: info.softwareVersion, serial: info.serial,
    protocol, dpi: 203, headPixels: 96,
    geometrySource: `${GEOMETRY_SOURCE}${info.printheadWidth === 96 ? "; lebar dikonfirmasi printer" : "; lebar dari metadata model, belum diukur pada unit ini"}`,
    task: model === "D110_M" && protocol === 4 ? "D110M_V4" :
      model === "D110" && (info.modelId === 2305 || protocol === 1 || protocol === 2) ? "D110" : "B1",
  };
}

export async function waitForCompletion(
  status: () => Promise<{ page: number; pagePrintProgress: number; pageFeedProgress: number; error: number }>,
  connected: () => boolean,
  timeoutMs = 20_000,
  pause: () => Promise<void> = () => new Promise(resolve => setTimeout(resolve, 300)),
) {
  const deadline = Date.now() + timeoutMs;
  let page = 0;
  while (Date.now() < deadline) {
    if (!connected()) throw new Error("Printer terputus saat menunggu hasil cetak.");
    const response = await status();
    page = response.page;
    if (response.error) throw new Error(`Printer melaporkan kesalahan ${response.error}.`);
    if (page === 1 && response.pagePrintProgress === 100 && response.pageFeedProgress === 100) return;
    await pause();
  }
  throw new Error(`Batas waktu konfirmasi habis; penghitung halaman ${page} dari 1. Perintah akhir bukan bukti tiket tercetak.`);
}

export type PrinterDevice = { transport: "USB"; port: SerialPort } | { transport: "Bluetooth"; device: BluetoothDevice };

class BluetoothConnection extends NiimbotBluetoothClient {
  override sendPacketWaitResponse(packet: NiimbotPacket, timeoutMs = 1000): Promise<NiimbotPacket> {
    if (packet.oneWay) return super.sendPacketWaitResponse(packet, timeoutMs);
    return this.mutex.runExclusive(() => sendWithReply(this, packet, timeoutMs));
  }
}

export class NiimbotAdapter {
  readonly client: UsbSerialConnection | NiimbotBluetoothClient;
  identity?: PrinterIdentity;
  constructor(private readonly selected: PrinterDevice) {
    this.client = selected.transport === "USB" ? new UsbSerialConnection(selected.port) : new BluetoothConnection();
    this.client.setHeartbeatAutoStart(false);
    this.client.setFetchRfidOnPrintEnd(false);
  }
  async connect() {
    try {
      const connection = this.selected.transport === "Bluetooth" && this.client instanceof NiimbotBluetoothClient
        ? await this.client.connect({ authorizedDevice: this.selected.device }) : await this.client.connect();
      if (![ConnectResult.Connected, ConnectResult.ConnectedNew, ConnectResult.ConnectedV3].includes(connection.result)) throw new Error("Printer menolak koneksi.");
      this.identity = identifyPrinter(this.client.getPrinterInfo());
      return { connection, identity: this.identity, transport: this.selected.transport };
    } catch (error) { await this.disconnect(); throw error; }
  }
  async readPaper(): Promise<PaperReading> {
    if (!this.client.isConnected()) throw new Error("Printer belum terhubung.");
    const notes: string[] = [];
    const rfid = await this.client.protocol.rfidInfo().catch(() => { notes.push("RFID tidak tersedia pada unit ini."); return undefined; });
    const paper = await this.client.protocol.getPaperInfo().catch(() => { notes.push("Dimensi PaperInfo tidak tersedia."); return undefined; });
    const sensor = await this.client.protocol.heartbeat().catch(() => { notes.push("Sensor kertas dan penutup tidak memberi status."); return undefined; });
    const type = (!paper?.valid || !paper.paperType) && (!rfid?.tagPresent || !rfid.consumablesType)
      ? await this.client.protocol.getLabelType().catch(() => undefined) : undefined;
    return paperReading(rfid, paper, notes, sensor, type);
  }
  preflight(profile: LabelProfile, reading: PaperReading) {
    if (!this.identity || !this.client.isConnected()) throw new Error("Printer belum siap.");
    if (![1, 5].includes(profile.labelType)) throw new Error("Jenis kertas tidak didukung D110; gunakan label bercelah atau transparan.");
    if (reading.inserted === false) throw new Error("Kertas habis/tidak terpasang.");
    if (reading.lidClosed === false) throw new Error("Penutup printer terbuka.");
  }
  async print(canvas: HTMLCanvasElement, profile: LabelProfile, waiting: () => void) {
    const identity = this.identity;
    if (!identity || !this.client.isConnected()) throw new Error("Printer belum siap.");
    const image = ImageEncoder.encodeCanvas(canvas, PageColorType.SingleColor, "left");
    if (image.cols > identity.headPixels) throw new Error("Bitmap melebihi lebar kepala cetak.");
    const task = this.client.protocol.newPrintTask(identity.task, {
      totalPages: 1, labelType: profile.labelType, density: identity.model === "D110" ? 2 : 3, pageTimeoutMs: 1500,
    });
    let stage = "memulai pekerjaan";
    let endAttempted = false;
    try {
      await task.printInit();
      stage = "mengirim halaman label";
      if (identity.modelId === 2304 && identity.task === "B1") {
        // Measured D110 sequence: one page, six-byte geometry, total-count bitmap rows.
        await this.client.protocol.sendAll([
          PacketGenerator.pageStart(), PacketGenerator.setPageSize6b(image.rows, image.cols, 1),
          ...PacketGenerator.writeImageData(image, { printheadPixels: identity.headPixels, countsMode: "total", noIndexPacket: true }),
          PacketGenerator.pageEnd(),
        ], 2000);
      } else {
        await task.printPage(image, 1);
      }
      waiting();
      // Library's polling has no overall deadline when page stays 0. Use bounded,
      // sequential status reads; neither printend nor packet ACK confirms output.
      stage = "menunggu konfirmasi halaman";
      await waitForCompletion(() => this.client.protocol.getPrintStatus(2), () => this.client.isConnected());
      stage = "mengakhiri cetak";
      endAttempted = true;
      if (!await task.printEnd()) throw new Error("Perintah akhir belum dikonfirmasi printer.");
    } catch (error) {
      throw new Error(`${identity.model} · ${this.selected.transport} · ${identity.task} gagal saat ${stage}: ${error instanceof Error ? error.message : String(error)}`);
    } finally {
      if (!endAttempted && this.client.isConnected()) await task.printEnd().catch(() => undefined);
    }
  }
  async disconnect() {
    await this.client.disconnect();
    if (this.selected.transport === "Bluetooth" && this.selected.device.gatt?.connected) this.selected.device.gatt.disconnect();
  }
}
