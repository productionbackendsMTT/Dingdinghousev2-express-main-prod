import { BaseSlotGame } from "./base.slot";

export const gameRegistry: Record<string, new (data: any) => BaseSlotGame> = {
  // Example:
  // "SL-CM": CashMachineGame,
  // Add other game mappings here
};
