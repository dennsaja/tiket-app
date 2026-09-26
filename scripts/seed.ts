import { drizzle } from "drizzle-orm/node-postgres";
import { Pool } from "pg";
import * as dotenv from "dotenv";
import bcrypt from "bcryptjs";
import * as schema from "../src/lib/db/schema";

dotenv.config({ path: ".env.local" });

async function seed() {
  const connectionString = process.env.DATABASE_URL;
  if (!connectionString) throw new Error("DATABASE_URL is required");

  const pool = new Pool({ connectionString });
  const db = drizzle(pool, { schema });

  console.log("🌱 Seeding database...");

  // ── Departments ──────────────────────────────────────────────────────────────
  console.log("  Creating departments...");
  const [techDept, supportDept, billingDept, networkDept] = await db
    .insert(schema.departments)
    .values([
      { name: "Technical Support", description: "Hardware and software issues", color: "#4f46e5" },
      { name: "Customer Support", description: "General customer inquiries", color: "#0891b2" },
      { name: "Billing", description: "Billing and payment issues", color: "#059669" },
      { name: "Network Operations", description: "Network and connectivity issues", color: "#dc2626" },
    ])
    .returning()
    .onConflictDoNothing();

  // ── Categories ────────────────────────────────────────────────────────────────
  console.log("  Creating categories...");
  const [hardwareCat, softwareCat, connCat, accountCat, paymentCat] = await db
    .insert(schema.categories)
    .values([
      { name: "Hardware", description: "Physical device issues", departmentId: techDept?.id },
      { name: "Software", description: "Application and OS issues", departmentId: techDept?.id },
      { name: "Connectivity", description: "Network and internet issues", departmentId: networkDept?.id },
      { name: "Account Management", description: "Account settings and access", departmentId: supportDept?.id },
      { name: "Payments", description: "Billing and payment processing", departmentId: billingDept?.id },
    ])
    .returning()
    .onConflictDoNothing();

  // ── Subcategories ─────────────────────────────────────────────────────────────
  if (hardwareCat) {
    await db
      .insert(schema.subcategories)
      .values([
        { name: "Laptop/Desktop", categoryId: hardwareCat.id },
        { name: "Printer", categoryId: hardwareCat.id },
        { name: "Networking Equipment", categoryId: hardwareCat.id },
      ])
      .onConflictDoNothing();
  }
  if (connCat) {
    await db
      .insert(schema.subcategories)
      .values([
        { name: "Slow Connection", categoryId: connCat.id },
        { name: "No Connection", categoryId: connCat.id },
        { name: "VPN Issues", categoryId: connCat.id },
      ])
      .onConflictDoNothing();
  }

  // ── Tags ──────────────────────────────────────────────────────────────────────
  console.log("  Creating tags...");
  await db
    .insert(schema.tags)
    .values([
      { name: "urgent", color: "#dc2626" },
      { name: "outage", color: "#7c3aed" },
      { name: "customer-complaint", color: "#ea580c" },
      { name: "recurring", color: "#0891b2" },
      { name: "needs-approval", color: "#d97706" },
      { name: "escalated", color: "#be185d" },
    ])
    .onConflictDoNothing();

  // ── SLA Policies ──────────────────────────────────────────────────────────────
  console.log("  Creating SLA policies...");
  await db
    .insert(schema.slaPolicies)
    .values([
      {
        name: "Critical SLA",
        priority: "critical",
        firstResponseMinutes: 30,
        resolutionMinutes: 240, // 4 hours
        warningThresholdPercent: 75,
        useBusinessHours: false,
      },
      {
        name: "High Priority SLA",
        priority: "high",
        firstResponseMinutes: 120, // 2 hours
        resolutionMinutes: 480, // 8 hours
        warningThresholdPercent: 80,
        useBusinessHours: false,
      },
      {
        name: "Medium Priority SLA",
        priority: "medium",
        firstResponseMinutes: 240, // 4 hours
        resolutionMinutes: 1440, // 24 hours
        warningThresholdPercent: 80,
        useBusinessHours: true,
      },
      {
        name: "Low Priority SLA",
        priority: "low",
        firstResponseMinutes: 480, // 8 hours
        resolutionMinutes: 4320, // 3 days
        warningThresholdPercent: 85,
        useBusinessHours: true,
      },
    ])
    .onConflictDoNothing();

  // ── Business Hours ────────────────────────────────────────────────────────────
  console.log("  Creating business hours...");
  await db
    .insert(schema.businessHours)
    .values([
      { dayOfWeek: 0, isOpen: false, openTime: "09:00", closeTime: "17:00" }, // Sunday
      { dayOfWeek: 1, isOpen: true, openTime: "09:00", closeTime: "17:00" },  // Monday
      { dayOfWeek: 2, isOpen: true, openTime: "09:00", closeTime: "17:00" },  // Tuesday
      { dayOfWeek: 3, isOpen: true, openTime: "09:00", closeTime: "17:00" },  // Wednesday
      { dayOfWeek: 4, isOpen: true, openTime: "09:00", closeTime: "17:00" },  // Thursday
      { dayOfWeek: 5, isOpen: true, openTime: "09:00", closeTime: "17:00" },  // Friday
      { dayOfWeek: 6, isOpen: false, openTime: "09:00", closeTime: "17:00" }, // Saturday
    ])
    .onConflictDoNothing();

  // ── Users ─────────────────────────────────────────────────────────────────────
  console.log("  Creating demo users...");
  const adminHash = await bcrypt.hash("Admin@123456", 12);
  const agentHash = await bcrypt.hash("Agent@123456", 12);
  const userHash = await bcrypt.hash("User@123456", 12);

  const [adminUser, agentUser, demoUser] = await db
    .insert(schema.users)
    .values([
      {
        name: "Admin User",
        email: "admin@helpdesk.local",
        passwordHash: adminHash,
        role: "admin",
        emailVerified: new Date(),
        isActive: true,
      },
      {
        name: "Agent Smith",
        email: "agent@helpdesk.local",
        passwordHash: agentHash,
        role: "agent",
        departmentId: techDept?.id,
        emailVerified: new Date(),
        isActive: true,
      },
      {
        name: "Demo User",
        email: "user@helpdesk.local",
        passwordHash: userHash,
        role: "user",
        emailVerified: new Date(),
        isActive: true,
      },
    ])
    .returning()
    .onConflictDoNothing();

  // ── System Settings ───────────────────────────────────────────────────────────
  console.log("  Creating system settings...");
  await db
    .insert(schema.systemSettings)
    .values([
      { key: "app_name", value: "HelpDesk", description: "Application name" },
      { key: "app_timezone", value: "Asia/Jakarta", description: "Application timezone" },
      { key: "tickets_per_page", value: "25", description: "Default tickets per page" },
      { key: "allow_registration", value: "true", description: "Allow public registration" },
      { key: "auto_assign", value: "false", description: "Auto-assign tickets to agents" },
    ])
    .onConflictDoNothing();

  // ── Demo Tickets ──────────────────────────────────────────────────────────────
  if (demoUser && adminUser) {
    console.log("  Creating demo tickets...");
    const ticketData = [
      {
        title: "Cannot connect to VPN after recent update",
        description: "After the latest Windows update on my laptop, I can no longer connect to the company VPN. I get error code 619. I have tried restarting the VPN client and the computer but the issue persists.",
        status: "open" as const,
        priority: "high" as const,
        requesterId: demoUser.id,
        departmentId: networkDept?.id,
        categoryId: connCat?.id,
        reporterName: "Ahmad Riyadi (IT Support Cabang)",
        reporterAddress: "Gedung Cyber 2 Lantai 15, Jl. HR Rasuna Said Blok X-5, Kuningan, Jakarta Selatan",
        reporterMapUrl: "https://maps.app.goo.gl/uX3QxP6qC6D2",
      },
      {
        title: "Printer not printing in color",
        description: "The office printer on the 3rd floor is not printing in color anymore. Only printing in black and white. We need this fixed urgently for a presentation tomorrow.",
        status: "assigned" as const,
        priority: "medium" as const,
        requesterId: demoUser.id,
        departmentId: techDept?.id,
        categoryId: hardwareCat?.id,
        assigneeId: agentUser?.id,
        reporterName: "Siti Rahmawati",
        reporterAddress: "Ruang Marketing Lantai 3, Gedung Utama",
      },
      {
        title: "Invoice discrepancy for December",
        description: "We received an invoice for December that doesn't match the agreed-upon pricing. The invoice shows $1,500 but our contract says $1,200. Please review and correct.",
        status: "in_progress" as const,
        priority: "high" as const,
        requesterId: demoUser.id,
        departmentId: billingDept?.id,
        categoryId: paymentCat?.id,
        assigneeId: agentUser?.id,
      },
      {
        title: "Request for additional software license",
        description: "We need an additional Adobe Creative Suite license for our new marketing team member starting next Monday. Please provide the license key.",
        status: "pending" as const,
        priority: "low" as const,
        requesterId: demoUser.id,
        departmentId: techDept?.id,
        categoryId: softwareCat?.id,
      },
      {
        title: "System outage - production database unreachable",
        description: "CRITICAL: The production database is completely unreachable since 14:30 UTC. All production services are down. Immediate assistance required.",
        status: "resolved" as const,
        priority: "critical" as const,
        requesterId: demoUser.id,
        departmentId: networkDept?.id,
        assigneeId: agentUser?.id,
        resolvedAt: new Date(),
        resolution: "Database connection pool was exhausted. Increased max connections from 100 to 200 and restarted the database service. All services are now operational.",
      },
    ];

    for (const tData of ticketData) {
      const [ticket] = await db
        .insert(schema.tickets)
        .values(tData)
        .returning();

      // Add initial status history
      await db.insert(schema.ticketStatusHistory).values({
        ticketId: ticket.id,
        fromStatus: null,
        toStatus: tData.status,
        changedById: adminUser.id,
        reason: "Ticket created",
      });
    }
  }

  console.log("✅ Database seeded successfully!");
  console.log("\n📋 Demo accounts:");
  console.log("  Admin:  admin@helpdesk.local  /  Admin@123456");
  console.log("  Agent:  agent@helpdesk.local  /  Agent@123456");
  console.log("  User:   user@helpdesk.local   /  User@123456");

  await pool.end();
}

seed().catch((err) => {
  console.error("❌ Seed failed:", err);
  process.exit(1);
});
