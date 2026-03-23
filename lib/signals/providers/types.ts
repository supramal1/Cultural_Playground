export type SignalsProviderInput = {
  keywords: string[];
  audience?: string;
  from?: string;
  to?: string;
  momentTitles?: string[];
};

export type SignalsProviderResult<T> = {
  data?: T;
  warnings: string[];
};
