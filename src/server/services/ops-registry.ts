import "server-only";
import { ApiError } from "@/lib/api-route";
import * as users from "./users";
import * as workers from "./workers";
import * as garments from "./garments";
import * as inventory from "./inventory";
import * as expenses from "./expenses";
import * as appointments from "./appointments";
import * as tasks from "./tasks";
import type { Actor, Input, ListOptions } from "./ops-common";

type ResourceService = {
  list: (actor: Actor, options?: ListOptions) => Promise<{ rows: unknown[]; total: number; page: number; limit: number }>;
  get: (actor: Actor, id: string) => Promise<unknown>;
  create: (actor: Actor, input: Input) => Promise<unknown>;
  update: (actor: Actor, id: string, input: Input) => Promise<unknown>;
  archive: (actor: Actor, id: string) => Promise<unknown>;
};
export const opsResources: Record<string, ResourceService> = {
  users: { list: users.listUsers, get: users.getUser, create: users.createUser, update: users.updateUser, archive: users.archiveUser },
  workers: { list: workers.listWorkers, get: workers.getWorker, create: workers.createWorker, update: workers.updateWorker, archive: workers.archiveWorker },
  garments: { list: garments.listGarments, get: garments.getGarment, create: garments.createGarment, update: garments.updateGarment, archive: garments.archiveGarment },
  fabrics: { list: inventory.listFabrics, get: inventory.getFabric, create: inventory.createFabric, update: inventory.updateFabric, archive: inventory.archiveFabric },
  expenses: { list: expenses.listExpenses, get: expenses.getExpense, create: expenses.createExpense, update: expenses.updateExpense, archive: expenses.archiveExpense },
  appointments: { list: appointments.listAppointments, get: appointments.getAppointment, create: appointments.createAppointment, update: appointments.updateAppointment, archive: appointments.cancelAppointment },
  tasks: { list: tasks.listTasks, get: tasks.getTask, create: tasks.createTask, update: tasks.updateTask, archive: tasks.cancelTask },
};
export function opsResource(name: string): ResourceService {
  if (!Object.hasOwn(opsResources, name)) throw new ApiError(404, "NOT_FOUND", "এই তথ্যের ধরন পাওয়া যায়নি");
  return opsResources[name];
}
