import type { NiimbotAbstractClient, NiimbotPacket } from "@mmote/niimbluelib";

// A printer may notify before the browser resolves its serial or GATT write.
// Caller holds the library's command mutex throughout this exchange.
export async function sendWithReply(client: NiimbotAbstractClient, packet: NiimbotPacket, timeoutMs: number) {
  const [reply] = await Promise.all([
    client.waitForPacket(packet.validResponseIds, true, timeoutMs),
    client.sendPacket(packet, true),
  ]);
  return reply;
}
