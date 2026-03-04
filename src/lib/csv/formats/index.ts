import type { BankFormat, SupportedBank } from "@/types/csv";
import { chaseFormat } from "./chase";
import { amexFormat } from "./amex";
import { capitalOneFormat } from "./capital-one";
import { citiFormat } from "./citi";
import { boaFormat } from "./boa";
import { discoverFormat } from "./discover";
import { wellsFargoFormat } from "./wells-fargo";

export const bankFormats: Record<SupportedBank, BankFormat> = {
  chase: chaseFormat,
  amex: amexFormat,
  "capital-one": capitalOneFormat,
  citi: citiFormat,
  boa: boaFormat,
  discover: discoverFormat,
  "wells-fargo": wellsFargoFormat,
};

export {
  chaseFormat,
  amexFormat,
  capitalOneFormat,
  citiFormat,
  boaFormat,
  discoverFormat,
  wellsFargoFormat,
};
