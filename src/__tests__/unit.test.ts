import { describe, it, expect, vi } from "vitest";
import { loginSchema, registerSchema, createTicketSchema } from "@/lib/validations";
import { formatFileSize, getInitials, isOverdue, getTicketStatusLabel, slugify } from "@/lib/utils";
import { isSlaBreached, getSlaPercentage } from "@/lib/sla";
import { rateLimit } from "@/lib/rate-limit";
import { canAccessTicket, canModifyTicket, canReplyToTicket } from "@/lib/auth/helpers";

// Mock auth and navigation
vi.mock("@/lib/auth", () => ({
  auth: vi.fn(),
}));

vi.mock("next/navigation", () => ({
  redirect: vi.fn(),
}));

// Mock database
vi.mock("@/lib/db", () => ({
  db: {
    query: {
      users: {
        findFirst: vi.fn(),
      },
    },
    insert: vi.fn(() => ({
      values: vi.fn(() => ({
        returning: vi.fn(() => Promise.resolve([{
          id: "user-123",
          email: "test@example.com",
          name: "Test User",
          role: "user",
        }])),
      })),
    })),
    update: vi.fn(() => ({
      set: vi.fn(() => ({
        where: vi.fn(() => Promise.resolve()),
      })),
    })),
  },
}));

describe("Authentication", () => {
  it("should reject login with empty credentials", () => {
    const result = loginSchema.safeParse({ email: "", password: "" });
    expect(result.success).toBe(false);
  });

  it("should reject login with invalid email", () => {
    const result = loginSchema.safeParse({
      email: "not-an-email",
      password: "password123",
    });
    expect(result.success).toBe(false);
  });

  it("should accept valid login credentials format", () => {
    const result = loginSchema.safeParse({
      email: "user@example.com",
      password: "password123",
    });
    expect(result.success).toBe(true);
  });

  it("should reject weak passwords on registration", () => {
    const result = registerSchema.safeParse({
      name: "Test User",
      email: "test@example.com",
      password: "weak",
    });
    expect(result.success).toBe(false);
  });

  it("should accept strong passwords on registration", () => {
    const result = registerSchema.safeParse({
      name: "Test User",
      email: "test@example.com",
      password: "StrongPass1",
    });
    expect(result.success).toBe(true);
  });
});

describe("Ticket Validation", () => {
  it("should reject ticket with short title", () => {
    const result = createTicketSchema.safeParse({
      title: "Hi",
      description: "This is a valid description that is long enough.",
    });
    expect(result.success).toBe(false);
  });

  it("should reject ticket with short description", () => {
    const result = createTicketSchema.safeParse({
      title: "This is a valid title",
      description: "Too short",
    });
    expect(result.success).toBe(false);
  });

  it("should accept valid ticket", () => {
    const result = createTicketSchema.safeParse({
      title: "Cannot connect to VPN after update",
      description:
        "Since the recent Windows update, I cannot connect to the company VPN anymore. Error code 619 is shown.",
      priority: "high",
    });
    expect(result.success).toBe(true);
  });

  it("should accept valid ticket with reporter information", () => {
    const result = createTicketSchema.safeParse({
      title: "Kendala koneksi internet di kantor cabang",
      description: "Internet mati sejak pagi, lampu indikator merah di router utama.",
      priority: "high",
      reporterName: "Budi Santoso",
      reporterAddress: "Gedung Cyber 2 Lt 15, Jl. HR Rasuna Said, Jaksel",
      reporterMapUrl: "https://maps.app.goo.gl/uX3QxP6qC6D2",
    });
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.reporterName).toBe("Budi Santoso");
      expect(result.data.reporterAddress).toBe("Gedung Cyber 2 Lt 15, Jl. HR Rasuna Said, Jaksel");
      expect(result.data.reporterMapUrl).toBe("https://maps.app.goo.gl/uX3QxP6qC6D2");
    }
  });

  it("should reject invalid Google Maps URL", () => {
    const result = createTicketSchema.safeParse({
      title: "Kendala koneksi internet di kantor cabang",
      description: "Internet mati sejak pagi, lampu indikator merah di router utama.",
      reporterMapUrl: "bukan-url-valid",
    });
    expect(result.success).toBe(false);
  });

  it("should accept empty or null reporter fields (backward compatibility)", () => {
    const result = createTicketSchema.safeParse({
      title: "Ticket without reporter info",
      description: "Description long enough for testing backward compatibility.",
      reporterName: null,
      reporterAddress: "",
      reporterMapUrl: null,
    });
    expect(result.success).toBe(true);
  });

  it("should default priority to medium", () => {
    const result = createTicketSchema.safeParse({
      title: "This is a valid title for the ticket",
      description: "This is a long enough description for the ticket content.",
    });
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.priority).toBe("medium");
    }
  });
});

describe("Auth Helper Permissions", () => {
  it("should allow any authenticated user to view tickets via shared link", () => {
    expect(canAccessTicket("user", "user-2", "user-1", "agent-1")).toBe(true);
    expect(canAccessTicket("agent", "agent-2", "user-1", "agent-1")).toBe(true);
    expect(canAccessTicket("admin", "admin-1", "user-1", null)).toBe(true);
  });

  it("should restrict modify permissions to agents and admins only", () => {
    expect(canModifyTicket("admin", "admin-1", "user-1", null)).toBe(true);
    expect(canModifyTicket("agent", "agent-1", "user-1", null)).toBe(true);
    expect(canModifyTicket("user", "user-1", "user-1", null)).toBe(false);
  });

  it("should allow requester, agent, and admin to reply to ticket", () => {
    expect(canReplyToTicket("user", "user-1", "user-1", null)).toBe(true);
    expect(canReplyToTicket("user", "user-2", "user-1", null)).toBe(false);
    expect(canReplyToTicket("agent", "agent-1", "user-1", null)).toBe(true);
    expect(canReplyToTicket("admin", "admin-1", "user-1", null)).toBe(true);
  });
});

describe("Utility Functions", () => {
  it("should format file size correctly", () => {
    expect(formatFileSize(0)).toBe("0 B");
    expect(formatFileSize(1024)).toBe("1 KB");
    expect(formatFileSize(1048576)).toBe("1 MB");
    expect(formatFileSize(1073741824)).toBe("1 GB");
  });

  it("should get correct initials", () => {
    expect(getInitials("John Doe")).toBe("JD");
    expect(getInitials("Alice")).toBe("A");
    expect(getInitials("John Michael Doe")).toBe("JM");
  });

  it("should detect SLA breach correctly", () => {
    const pastDate = new Date(Date.now() - 60000);
    const futureDate = new Date(Date.now() + 60000);
    expect(isOverdue(pastDate)).toBe(true);
    expect(isOverdue(futureDate)).toBe(false);
    expect(isOverdue(null)).toBe(false);
  });

  it("should format ticket status labels in Bahasa Indonesia", () => {
    expect(getTicketStatusLabel("open")).toBe("Baru");
    expect(getTicketStatusLabel("in_progress")).toBe("Sedang Dikerjakan");
    expect(getTicketStatusLabel("waiting_for_user")).toBe("Menunggu Respons User");
    expect(getTicketStatusLabel("closed")).toBe("Ditutup");
  });

  it("should slugify text correctly", () => {
    expect(slugify("Hello World")).toBe("hello-world");
    expect(slugify("Special!@#$% Characters")).toBe("special-characters");
  });
});

describe("SLA Utilities", () => {
  it("should detect SLA breach", () => {
    const pastDate = new Date(Date.now() - 3600000);
    expect(isSlaBreached(pastDate)).toBe(true);
    expect(isSlaBreached(new Date(Date.now() + 3600000))).toBe(false);
    expect(isSlaBreached(null)).toBe(false);
  });

  it("should calculate SLA percentage", () => {
    const start = new Date(Date.now() - 50 * 60 * 1000);
    const due = new Date(Date.now() + 50 * 60 * 1000);
    const pct = getSlaPercentage(start, due);
    expect(pct).toBeGreaterThan(45);
    expect(pct).toBeLessThan(60);
  });
});

describe("Rate Limiting", () => {
  it("should allow requests within limit", () => {
    const result = rateLimit("test-key-unique-1", { windowMs: 60000, max: 5 });
    expect(result.success).toBe(true);
  });

  it("should block requests exceeding limit", () => {
    const key = "test-block-unique-1";
    for (let i = 0; i < 5; i++) {
      rateLimit(key, { windowMs: 60000, max: 5 });
    }
    const result = rateLimit(key, { windowMs: 60000, max: 5 });
    expect(result.success).toBe(false);
  });
});
