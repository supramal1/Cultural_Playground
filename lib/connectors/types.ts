import type { Moment } from "@/lib/schemas/moment";

export type ConnectorParams = {
  from: string;
  to: string;
  keywords?: string[];
  city?: string;
  forceRefresh?: boolean;
};

export type ConnectorResult = {
  name: string;
  moments: Moment[];
  cache: "hit" | "miss";
  warnings: string[];
};
