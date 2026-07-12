import { describe, expect, it } from "vitest";
import { translate, translations } from "./i18n";

describe("i18n", () => {
  it("has identical key sets across English and Chinese", () => {
    const en = Object.keys(translations.en).sort();
    const zh = Object.keys(translations.zh).sort();
    const missingInZh = en.filter((key) => !translations.zh[key]);
    const missingInEn = zh.filter((key) => !translations.en[key]);
    expect(missingInZh, "keys missing from zh").toEqual([]);
    expect(missingInEn, "keys missing from en").toEqual([]);
    expect(en).toEqual(zh);
  });

  it("has no empty translations", () => {
    for (const lang of ["en", "zh"] as const) {
      for (const [key, value] of Object.entries(translations[lang])) {
        expect(value.trim(), `${lang}.${key} is empty`).not.toBe("");
      }
    }
  });

  it("falls back to the key when a translation is missing", () => {
    expect(translate("en", "totally.unknown.key")).toBe("totally.unknown.key");
  });

  it("resolves representative Task 5 keys in both languages", () => {
    for (const key of ["auth.signIn", "projects.title", "guide.input.title", "privacy.demoNote"]) {
      expect(translate("en", key)).not.toBe(key);
      expect(translate("zh", key)).not.toBe(key);
    }
  });
});
