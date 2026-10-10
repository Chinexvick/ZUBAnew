import { media } from "./media";

/* Image by key, preferring the 2D version when one exists. */
export const art = (key: string) => media[`${key}-2d`] ?? media[key] ?? "";
