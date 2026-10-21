import { beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";

const mocks=vi.hoisted(()=>({ actor:vi.fn(), user:vi.fn(), ticket:vi.fn(), member:vi.fn(), messages:vi.fn(), update:vi.fn(), returning:vi.fn(), audit:vi.fn(), token:vi.fn() }));
vi.mock("@/lib/auth/get-user",()=>({getAuthUser:mocks.actor}));
vi.mock("@/lib/auth/mobile",()=>({signMobileToken:mocks.token}));
vi.mock("@/lib/db",()=>({db:{query:{users:{findFirst:mocks.user},tickets:{findFirst:mocks.ticket},ticketAssignees:{findFirst:mocks.member},ticketMessages:{findMany:mocks.messages}},update:mocks.update}}));
vi.mock("@/lib/audit",()=>({createAuditLog:mocks.audit,getClientIp:()=>"127.0.0.1"}));
vi.mock("@/lib/rate-limit",()=>({rateLimit:()=>({success:true}),rateLimitResponse:vi.fn()}));
vi.mock("@/lib/notifications",()=>({notifyNewMessage:vi.fn(),getTicketParticipantIds:vi.fn()}));
vi.mock("@/lib/notifications/bus",()=>({notificationBus:{emitSystemEvent:vi.fn()}}));
import { PATCH } from "@/app/api/mobile/profile/route";
import { GET } from "@/app/api/chat/rooms/[ticketId]/route";
import { GET as listTickets } from "@/app/api/mobile/tickets/route";
beforeEach(()=>{
  vi.clearAllMocks(); mocks.actor.mockResolvedValue({id:"tech",name:"Teknisi",email:"tech@example.test",role:"agent"});
  mocks.user.mockResolvedValue({id:"tech",name:"Teknisi",email:"tech@example.test",role:"agent",isActive:true,passwordHash:"unused"});
  mocks.ticket.mockResolvedValue({id:"ticket",assigneeId:"other",title:"Private group"}); mocks.member.mockResolvedValue(undefined); mocks.messages.mockResolvedValue([]);
  mocks.token.mockResolvedValue("refreshed-token"); mocks.audit.mockResolvedValue(undefined);
  mocks.returning.mockResolvedValue([{id:"tech",name:"Nama Baru",email:"tech@example.test",role:"agent",phone:"0812",avatarUrl:null}]);
  mocks.update.mockReturnValue({set:()=>({where:()=>({returning:mocks.returning})})});
});
const request=(body:object)=>new NextRequest("https://helpdesk.example.test/api/mobile/profile",{method:"PATCH",body:JSON.stringify(body),headers:{"content-type":"application/json"}});
describe("production mobile access",()=>{
  it("rejects customer accounts before listing staff tickets",async()=>{
    mocks.actor.mockResolvedValue({id:"customer",name:"Pelanggan",email:"customer@example.test",role:"user"});
    const response=await listTickets(new NextRequest("https://helpdesk.example.test/api/mobile/tickets"));
    expect(response.status).toBe(403); expect(mocks.ticket).not.toHaveBeenCalled();
  });
  it("never lets profile editing grant another role",async()=>{
    const response=await PATCH(request({name:"Nama Baru",email:"tech@example.test",role:"owner"}));
    expect(response.status).toBe(422); expect(mocks.update).not.toHaveBeenCalled();
  });
  it("requires the current password when changing login identity",async()=>{
    const response=await PATCH(request({name:"Nama Baru",email:"other@example.test"}));
    expect(response.status).toBe(422); expect(mocks.update).not.toHaveBeenCalled();
  });
  it.each(["agent","noc","admin","owner"])("allows %s to edit their own basic profile",async role=>{
    mocks.actor.mockResolvedValue({id:"tech",name:"Teknisi",email:"tech@example.test",role});
    const response=await PATCH(request({name:"Nama Baru",email:"tech@example.test",phone:"0812"}));
    expect(response.status).toBe(200); expect((await response.json()).token).toBe("refreshed-token");
  });
  it("rejects an agent outside the ticket team",async()=>{
    const response=await GET(new NextRequest("https://helpdesk.example.test/api/chat/rooms/ticket"),{params:Promise.resolve({ticketId:"ticket"})});
    expect(response.status).toBe(403); expect(mocks.messages).not.toHaveBeenCalled();
  });
  it("admits a supporting technician assigned to the ticket",async()=>{
    mocks.member.mockResolvedValue({ticketId:"ticket",userId:"tech"});
    const response=await GET(new NextRequest("https://helpdesk.example.test/api/chat/rooms/ticket"),{params:Promise.resolve({ticketId:"ticket"})});
    expect(response.status).toBe(200);
  });
});
