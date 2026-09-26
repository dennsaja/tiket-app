import { z } from "zod";

// ─── Auth ─────────────────────────────────────────────────────────────────────

export const loginSchema = z.object({
  email: z.string().email("Invalid email address"),
  password: z.string().min(1, "Password is required"),
});

export const registerSchema = z.object({
  name: z.string().min(2, "Name must be at least 2 characters").max(255),
  email: z.string().email("Invalid email address"),
  password: z
    .string()
    .min(8, "Password must be at least 8 characters")
    .regex(
      /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)/,
      "Password must contain uppercase, lowercase, and a number"
    ),
});

export const forgotPasswordSchema = z.object({
  email: z.string().email("Invalid email address"),
});

export const resetPasswordSchema = z
  .object({
    token: z.string().min(1),
    password: z
      .string()
      .min(8, "Password must be at least 8 characters")
      .regex(
        /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)/,
        "Password must contain uppercase, lowercase, and a number"
      ),
    confirmPassword: z.string(),
  })
  .refine((data) => data.password === data.confirmPassword, {
    message: "Passwords do not match",
    path: ["confirmPassword"],
  });

// ─── Tickets ──────────────────────────────────────────────────────────────────

export const createTicketSchema = z.object({
  title: z
    .string()
    .min(5, "Title must be at least 5 characters")
    .max(500, "Title is too long"),
  description: z
    .string()
    .min(10, "Description must be at least 10 characters")
    .max(50000, "Description is too long"),
  priority: z.enum(["critical", "high", "medium", "low"]).default("medium"),
  departmentId: z.string().optional(),
  categoryId: z.string().optional(),
  subcategoryId: z.string().optional(),
  tagIds: z.array(z.string()).optional(),
  reporterName: z.string().max(255, "Nama pelapor terlalu panjang (maks. 255 karakter)").optional().nullable(),
  reporterAddress: z.string().max(2000, "Alamat terlalu panjang (maks. 2000 karakter)").optional().nullable(),
  reporterMapUrl: z
    .string()
    .max(1000, "Link Google Maps terlalu panjang")
    .optional()
    .nullable()
    .refine(
      (val) => {
        if (!val || val.trim() === "") return true;
        try {
          const url = new URL(val.trim());
          return url.protocol === "http:" || url.protocol === "https:";
        } catch {
          return false;
        }
      },
      { message: "Link Google Maps harus berupa URL yang valid (diawali http:// atau https://)" }
    ),
});

export const updateTicketSchema = z.object({
  title: z.string().min(5).max(500).optional(),
  description: z.string().min(10).max(50000).optional(),
  priority: z.enum(["critical", "high", "medium", "low"]).optional(),
  status: z
    .enum([
      "open",
      "assigned",
      "in_progress",
      "pending",
      "waiting_for_user",
      "waiting_for_third_party",
      "resolved",
      "closed",
      "reopened",
      "cancelled",
    ])
    .optional(),
  assigneeId: z.string().nullable().optional(),
  departmentId: z.string().nullable().optional(),
  categoryId: z.string().nullable().optional(),
  subcategoryId: z.string().nullable().optional(),
  reporterName: z.string().max(255).nullable().optional(),
  reporterAddress: z.string().max(2000).nullable().optional(),
  reporterMapUrl: z
    .string()
    .max(1000)
    .nullable()
    .optional()
    .refine(
      (val) => {
        if (!val || val.trim() === "") return true;
        try {
          const url = new URL(val.trim());
          return url.protocol === "http:" || url.protocol === "https:";
        } catch {
          return false;
        }
      },
      { message: "Link Google Maps harus berupa URL yang valid" }
    ),
  resolution: z.string().max(50000).optional(),
  reason: z.string().max(1000).optional(),
});

export const assignTicketSchema = z.object({
  assigneeId: z.string().nullable(),
  reason: z.string().max(1000).optional(),
});

export const changeStatusSchema = z.object({
  status: z.enum([
    "open",
    "assigned",
    "in_progress",
    "pending",
    "waiting_for_user",
    "waiting_for_third_party",
    "resolved",
    "closed",
    "reopened",
    "cancelled",
  ]),
  reason: z.string().max(1000).optional(),
  resolution: z.string().max(50000).optional(),
});

// ─── Messages ─────────────────────────────────────────────────────────────────

export const createMessageSchema = z.object({
  content: z
    .string()
    .min(1, "Message cannot be empty")
    .max(50000, "Message is too long"),
  type: z.enum(["public", "internal_note"]).default("public"),
});

export const updateMessageSchema = z.object({
  content: z.string().min(1).max(50000),
});

// ─── Filters ──────────────────────────────────────────────────────────────────

export const ticketFiltersSchema = z.object({
  status: z
    .array(
      z.enum([
        "open",
        "assigned",
        "in_progress",
        "pending",
        "waiting_for_user",
        "waiting_for_third_party",
        "resolved",
        "closed",
        "reopened",
        "cancelled",
      ])
    )
    .optional(),
  priority: z.array(z.enum(["critical", "high", "medium", "low"])).optional(),
  assigneeId: z.string().optional(),
  requesterId: z.string().optional(),
  departmentId: z.string().optional(),
  categoryId: z.string().optional(),
  tagIds: z.array(z.string()).optional(),
  search: z.string().max(500).optional(),
  dateFrom: z.string().optional(),
  dateTo: z.string().optional(),
  slaBreached: z.boolean().optional(),
  page: z.number().int().min(1).default(1),
  perPage: z.number().int().min(1).max(100).default(25),
  sortBy: z
    .enum(["createdAt", "updatedAt", "priority", "status", "ticketNumber"])
    .default("createdAt"),
  sortOrder: z.enum(["asc", "desc"]).default("desc"),
});

// ─── Users ────────────────────────────────────────────────────────────────────

export const userRoles = ["noc", "owner", "admin", "agent", "user"] as const;

export const createUserSchema = z.object({
  name: z.string().min(2, "Nama minimal 2 karakter").max(255),
  email: z.string().email("Format email tidak valid"),
  password: z.string().min(8, "Password minimal 8 karakter").regex(/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)/, "Password harus mengandung huruf besar, kecil, dan angka"),
  role: z.enum(["noc", "owner", "admin", "agent", "user"]).default("user"),
  departmentId: z.string().optional(),
  phone: z.string().max(50).optional(),
});

export const updateUserSchema = z.object({
  name: z.string().min(2).max(255).optional(),
  email: z.string().email().optional(),
  role: z.enum(["noc", "owner", "admin", "agent", "user"]).optional(),
  departmentId: z.string().nullable().optional(),
  phone: z.string().max(50).nullable().optional(),
  isActive: z.boolean().optional(),
});

export const changePasswordSchema = z
  .object({
    currentPassword: z.string().min(1),
    newPassword: z.string().min(8).regex(/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)/),
    confirmPassword: z.string(),
  })
  .refine((data) => data.newPassword === data.confirmPassword, {
    message: "Passwords do not match",
    path: ["confirmPassword"],
  });

// ─── Departments ──────────────────────────────────────────────────────────────

export const createDepartmentSchema = z.object({
  name: z.string().min(2, "Nama departemen minimal 2 karakter").max(255),
  description: z.string().max(1000).optional(),
  color: z
    .string()
    .regex(/^#[0-9a-fA-F]{6}$/, "Format kode warna heksadesimal tidak valid (contoh: #000000)")
    .optional(),
});

export const updateDepartmentSchema = createDepartmentSchema
  .partial()
  .extend({ isActive: z.boolean().optional() });

// ─── Categories ───────────────────────────────────────────────────────────────

export const createCategorySchema = z.object({
  name: z.string().min(2).max(255),
  description: z.string().max(1000).optional(),
  departmentId: z.string().optional(),
});

export const createSubcategorySchema = z.object({
  name: z.string().min(2).max(255),
  description: z.string().max(1000).optional(),
  categoryId: z.string().min(1),
});

// ─── SLA ──────────────────────────────────────────────────────────────────────

export const createSlaPolicySchema = z.object({
  name: z.string().min(2, "Nama kebijakan minimal 2 karakter").max(255),
  description: z.string().max(1000).optional(),
  priority: z.enum(["critical", "high", "medium", "low"]),
  departmentId: z.string().optional().nullable(),
  firstResponseMinutes: z.number().int().min(1, "Target respons minimal 1 menit").max(43200),
  resolutionMinutes: z.number().int().min(1, "Target resolusi minimal 1 menit").max(259200),
  warningThresholdPercent: z.number().int().min(1).max(99).default(80),
  useBusinessHours: z.boolean().default(false),
});

export const updateSlaPolicySchema = createSlaPolicySchema
  .partial()
  .extend({ isActive: z.boolean().optional() });

// ─── Tags ─────────────────────────────────────────────────────────────────────

export const createTagSchema = z.object({
  name: z.string().min(1).max(100),
  color: z
    .string()
    .regex(/^#[0-9a-fA-F]{6}$/)
    .optional(),
});

// ─── Knowledge Base ───────────────────────────────────────────────────────────

export const createKbArticleSchema = z.object({
  title: z.string().min(5).max(500),
  content: z.string().min(50).max(100000),
  excerpt: z.string().max(500).optional(),
  status: z.enum(["draft", "published", "archived"]).default("draft"),
  categoryId: z.string().optional(),
});

// ─── Bulk Actions ─────────────────────────────────────────────────────────────

export const bulkTicketActionSchema = z.object({
  ticketIds: z.array(z.string()).min(1).max(100),
  action: z.enum([
    "assign",
    "unassign",
    "close",
    "resolve",
    "change_priority",
    "change_status",
    "change_department",
    "delete",
  ]),
  assigneeId: z.string().optional(),
  priority: z.enum(["critical", "high", "medium", "low"]).optional(),
  status: z
    .enum([
      "open",
      "assigned",
      "in_progress",
      "pending",
      "waiting_for_user",
      "waiting_for_third_party",
      "resolved",
      "closed",
      "reopened",
      "cancelled",
    ])
    .optional(),
  departmentId: z.string().optional(),
});
