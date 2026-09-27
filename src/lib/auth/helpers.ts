import { auth } from "@/lib/auth";
import { redirect } from "next/navigation";

export type UserRole = "noc" | "owner" | "admin" | "agent" | "user";

export async function getSession() {
  const session = await auth();
  return session;
}

export async function requireAuth() {
  const session = await auth();
  if (!session?.user) {
    redirect("/login");
  }
  return session;
}

export async function requireRole(roles: UserRole[]) {
  const session = await requireAuth();
  const userRole = (session.user as any).role as UserRole;
  if (!roles.includes(userRole)) {
    redirect("/unauthorized");
  }
  return session;
}

export async function requireAdmin() {
  return requireRole(["noc", "owner", "admin"]);
}

export async function requireNocOrOwner() {
  return requireRole(["noc", "owner"]);
}

export async function requireAgentOrAdmin() {
  return requireRole(["noc", "owner", "admin", "agent"]);
}

export function isSuperAdmin(role: string): boolean {
  return role === "noc";
}

export function isOwner(role: string): boolean {
  return role === "owner";
}

export function isAdmin(role: string): boolean {
  return role === "noc" || role === "owner" || role === "admin";
}

export function isAgent(role: string): boolean {
  return role === "noc" || role === "owner" || role === "admin" || role === "agent";
}

export function isUser(role: string): boolean {
  return role === "user";
}

// Check if user can access ticket (Shared links: all authenticated users can view tickets)
export function canAccessTicket(
  userRole: string,
  userId: string,
  ticketRequesterId: string,
  ticketAssigneeId: string | null
): boolean {
  // Any authenticated user can view the ticket details and public thread
  return true;
}

// Check if user can reply to a ticket
export function canReplyToTicket(
  userRole: string,
  userId: string,
  ticketRequesterId: string,
  ticketAssigneeId: string | null
): boolean {
  if (["noc", "owner", "admin", "agent"].includes(userRole)) return true;
  return userId === ticketRequesterId;
}

// Check if user can modify ticket (status, assignment, priority, deletion, edit)
export function canModifyTicket(
  userRole: string,
  userId: string,
  ticketRequesterId: string,
  ticketAssigneeId: string | null
): boolean {
  if (["noc", "owner", "admin", "agent"].includes(userRole)) return true;
  return false;
}

// Check if user can create tickets (Strictly restricted to NOC, Owner, Admin)
export function canCreateTicket(userRole: string): boolean {
  return ["noc", "owner", "admin"].includes(userRole);
}

// Check if user can write internal notes
export function canWriteInternalNotes(userRole: string): boolean {
  return ["noc", "owner", "admin", "agent"].includes(userRole);
}

