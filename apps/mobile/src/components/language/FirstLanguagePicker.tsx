import { View } from "react-native";

import { ListRow } from "@/components/ui";
import {
    FIRST_LANGUAGES,
    FIRST_LANGUAGE_ENGLISH_NAMES,
    FIRST_LANGUAGE_LABELS,
    type FirstLanguage,
} from "@/lib/firstLanguage/languages";

type Props<Language extends FirstLanguage> = {
    value: Language | null;
    onChange: (language: Language) => void;
    /**
     * Every first language unless told otherwise. The speaking tutor passes the
     * shorter list it can teach from, which has no English in it.
     */
    languages?: readonly Language[];
    /** What a screen reader calls the group, usually the question being asked. */
    label: string;
    /** Indent the rows to line up with the titles of icon rows above them. */
    inset?: boolean;
};

/**
 * The first languages as one radio list, used on the onboarding screen
 * and again under Account so the learner meets the same list both times.
 *
 * Each language leads with its own name in its own script: somebody looking for
 * their language finds বাংলা faster than "Bengali", and some of the learners
 * this is for read no English at all. The English name follows quietly, for the
 * learner running the app in English and for whoever is helping them.
 */
export function FirstLanguagePicker<Language extends FirstLanguage = FirstLanguage>({
    value,
    onChange,
    label,
    inset = false,
    languages = FIRST_LANGUAGES as readonly FirstLanguage[] as readonly Language[],
}: Props<Language>) {
    return (
        <View accessibilityRole="radiogroup" accessibilityLabel={label}>
            {languages.map((language, index) => {
                const own = FIRST_LANGUAGE_LABELS[language];
                const english = FIRST_LANGUAGE_ENGLISH_NAMES[language];
                return (
                    <ListRow
                        key={language}
                        title={own}
                        // Filipino calls itself what English calls it. The
                        // repeat is kept so every row has the same two
                        // columns; a lone title left the row looking unfinished.
                        value={english}
                        trailing="check"
                        inset={inset}
                        selected={language === value}
                        accessibilityRole="radio"
                        last={index === languages.length - 1}
                        onPress={() => onChange(language)}
                    />
                );
            })}
        </View>
    );
}
