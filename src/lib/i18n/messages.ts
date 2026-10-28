import { common } from "./common";
import { dashboard } from "./dashboard";
import { watches } from "./watches";
import { wear } from "./wear";
import { form } from "./form";
import { timegrapher } from "./timegrapher";
import { LANGS, type Dict, type Lang, type NamespaceDict } from "./types";

const namespaces: NamespaceDict[] = [common, dashboard, watches, wear, form, timegrapher];

export const messages = LANGS.reduce(
  (acc, lang) => {
    acc[lang] = Object.assign({}, ...namespaces.map((ns) => ns[lang])) as Dict;
    return acc;
  },
  {} as Record<Lang, Dict>
);
