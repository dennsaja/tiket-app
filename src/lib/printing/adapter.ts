import { ImageEncoder, PageColorType, ResolutionClass } from "@mmote/niimbluelib";
import type { PrinterInfo } from "@mmote/niimbluelib";
import { UsbSerialConnection } from "./usb-connection";
import type { LabelProfile, PaperReading, PrinterIdentity } from "./types";
import { paperReading } from "./paper";

const GEOMETRY_SOURCE = "@mmote/niimbluelib 0.49.1 printer_models.ts; https://printers.niim.blue/hardware/models/";
export function identifyPrinter(info: PrinterInfo): PrinterIdentity {
  if (info.modelId === 2305) throw new Error("Model ID 2305 ambigu: D110 / HI_D110 memiliki geometri berbeda. Varian ini belum didukung; pencetakan diblokir.");
  const model = info.modelId === 2304 ? "D110" : info.modelId === 2320 ? "D110_M" : undefined;
  if (!model) throw new Error(`Printer tidak didukung (model ID ${info.modelId ?? "tidak tersedia"}). Hanya D110 2304 dan D110_M 2320.`);
  if (!info.protocolVersion || ![1, 2, 3, 4].includes(info.protocolVersion)) throw new Error(`Versi protokol ${info.protocolVersion} belum didukung.`);
  if (info.resolutionClass !== undefined && info.resolutionClass !== ResolutionClass.DPI203) throw new Error("DPI respons printer berbeda dengan profil 203 DPI yang diverifikasi; cetak diblokir.");
  if (info.printheadWidth !== undefined && info.printheadWidth !== 96) throw new Error(`Kepala cetak ${info.printheadWidth}px berbeda dari profil 96px; cetak diblokir.`);
  return {
    model, modelId: info.modelId!, firmware: info.softwareVersion, serial: info.serial,
    protocol: info.protocolVersion, dpi: 203, headPixels: 96,
    geometrySource: `${GEOMETRY_SOURCE}${info.printheadWidth === 96 ? "; lebar dikonfirmasi printer" : "; lebar dari metadata model, belum diukur pada unit ini"}`,
    task: model === "D110" ? "D110" : info.protocolVersion === 4 ? "D110M_V4" : "B1",
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
    if (!connected()) throw new Error("USB terputus saat menunggu hasil cetak.");
    const response = await status();
    page = response.page;
    if (response.error) throw new Error(`Printer melaporkan kesalahan ${response.error}.`);
    if (page === 1 && response.pagePrintProgress === 100 && response.pageFeedProgress === 100) return;
    await pause();
  }
  throw new Error(`Batas waktu konfirmasi habis; penghitung halaman ${page} dari 1. Perintah akhir bukan bukti tiket tercetak.`);
}

export class NiimbotUsbAdapter {
  readonly client: UsbSerialConnection;
  identity?: PrinterIdentity;
  constructor(port: SerialPort) { this.client = new UsbSerialConnection(port); }
  async connect() {
    const connection = await this.client.connect();
    try { this.identity = identifyPrinter(this.client.getPrinterInfo()); }
    catch (error) { await this.client.disconnect(); throw error; }
    return { connection, identity: this.identity };
  }
  async readPaper(): Promise<PaperReading> {
    if (!this.client.isConnected()) throw new Error("USB belum terhubung.");
    const notes: string[] = [];
    const rfid = await this.client.protocol.rfidInfo().catch(() => { notes.push("RFID tidak tersedia lewat USB pada unit/firmware ini."); return undefined; });
    const paper = await this.client.protocol.getPaperInfo().catch(() => { notes.push("Dimensi PaperInfo tidak tersedia."); return undefined; });
    const sensor = await this.client.protocol.heartbeat().catch(() => undefined);
    const type = (!paper?.valid || !paper.paperType) && (!rfid?.tagPresent || !rfid.consumablesType)
      ? await this.client.protocol.getLabelType().catch(() => undefined) : undefined;
    return paperReading(rfid, paper, notes, sensor, type);
  }
  async preflight(profile: LabelProfile) {
    if (!this.identity || !this.client.isConnected()) throw new Error("USB belum siap.");
    if (![1, 5].includes(profile.labelType)) throw new Error("Jenis kertas tidak didukung D110; gunakan label bercelah atau transparan.");
    const heartbeat = await this.client.protocol.heartbeat();
    if (heartbeat.paperInserted === false) throw new Error("Kertas habis/tidak terpasang.");
    if (heartbeat.lidClosed === false) throw new Error("Penutup printer terbuka.");
  }
  async print(canvas: HTMLCanvasElement, profile: LabelProfile, waiting: () => void) {
    const identity = this.identity;
    if (!identity || !this.client.isConnected()) throw new Error("USB belum siap.");
    const image = ImageEncoder.encodeCanvas(canvas, PageColorType.SingleColor, "left");
    if (image.cols > identity.headPixels) throw new Error("Bitmap melebihi lebar kepala cetak.");
    const task = this.client.protocol.newPrintTask(identity.task, {
      totalPages: 1, labelType: profile.labelType, density: identity.model === "D110" ? 2 : 3, pageTimeoutMs: 1500,
    });
    try {
      await task.printInit();
      await task.printPage(image, 1);
      waiting();
      // Library's polling has no overall deadline when page stays 0. Use bounded,
      // sequential status reads; neither printend nor packet ACK confirms output.
      await waitForCompletion(() => this.client.protocol.getPrintStatus(1), () => this.client.isConnected());
    } finally {
      if (this.client.isConnected()) await task.printEnd().catch(() => undefined);
    }
  }
  async disconnect() { await this.client.disconnect(); }
}
