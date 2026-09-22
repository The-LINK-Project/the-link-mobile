import en from "@/messages/en.json";

import { EXTRA_INTERFACE_COPY, type InterfaceNamespace } from "../interfaceCopy";

jest.mock("expo-localization", () => ({ getLocales: () => [] }));

const catalogue = en.mobile as Record<InterfaceNamespace, Record<string, unknown>>;
const languages = Object.keys(EXTRA_INTERFACE_COPY) as (keyof typeof EXTRA_INTERFACE_COPY)[];
const namespaces = Object.keys(EXTRA_INTERFACE_COPY[languages[0]]) as InterfaceNamespace[];

/** The `{name}` slots in a string, in order of first appearance. */
function placeholders(copy: string): string[] {
    return [...new Set([...copy.matchAll(/\{(\w+)\}/g)].map((match) => match[1]))].sort();
}

/**
 * Every language with copy here has to carry the same strings. The screens
 * fall back to English for a key that is missing, quietly, so a language that
 * translates half of the speaking practice ships that way without a test.
 */
describe("interface copy for the languages without an app catalogue", () => {
    it.each(languages)("%s has every key of every namespace", (language) => {
        for (const namespace of namespaces) {
            const keys = Object.keys(EXTRA_INTERFACE_COPY[language][namespace]).sort();
            const expected = Object.keys(EXTRA_INTERFACE_COPY[languages[0]][namespace]).sort();
            expect({ namespace, keys }).toEqual({ namespace, keys: expected });
        }
    });

    it.each(languages)("%s only carries keys the English catalogue has", (language) => {
        for (const namespace of namespaces) {
            for (const key of Object.keys(EXTRA_INTERFACE_COPY[language][namespace])) {
                // Nested keys such as `level.beginner` are written with a dot.
                const found = key
                    .split(".")
                    .reduce<unknown>(
                        (node, part) => (node as Record<string, unknown> | undefined)?.[part],
                        catalogue[namespace],
                    );
                expect({ namespace, key, found: typeof found }).toEqual({
                    namespace,
                    key,
                    found: "string",
                });
            }
        }
    });

    it.each(languages)(
        "%s keeps the placeholders of the English and is never empty",
        (language) => {
            for (const namespace of namespaces) {
                for (const [key, copy] of Object.entries(
                    EXTRA_INTERFACE_COPY[language][namespace],
                )) {
                    const english = key
                        .split(".")
                        .reduce<unknown>(
                            (node, part) => (node as Record<string, unknown> | undefined)?.[part],
                            catalogue[namespace],
                        ) as string;
                    expect({ namespace, key, copy: copy.trim().length > 0 }).toEqual({
                        namespace,
                        key,
                        copy: true,
                    });
                    expect({ namespace, key, slots: placeholders(copy) }).toEqual({
                        namespace,
                        key,
                        slots: placeholders(english),
                    });
                }
            }
        },
    );
});
