"use client";

import { createContext, useContext } from "react";

export const WorkspaceCurrencyContext = createContext("PKR");
export function useWorkspaceCurrency() {
  return useContext(WorkspaceCurrencyContext);
}
