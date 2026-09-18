import { View } from "react-native";

import { ListRow } from "@/components/ui";
import {
    FIRST_LANGUAGES,
    FIRST_LANGUAGE_ENGLISH_NAMES,
    FIRST_LANGUAGE_LABELS,
    type FirstLanguage,
} from "@/lib/firstLanguage/languages";

type Props = {
    value: FirstLanguage | null;
    onChange: (language: FirstLanguage) => void;
    /** What a screen reader calls the group, usually the question being asked. */
    label: string;
    /** Indent the rows to line up with the titles of icon rows above them. */
    inset?: boolean;
};

/**
 * The twelve first languages as one radio list, used on the onboarding screen
 * and again under Account so the learner meets the same list both times.
 *
 * Each language leads with its own name in its own script: somebody looking for
 * their language finds বাংলা faster than "Bengali", and some of the learners
 * this is for read no English at all. The English name follows quietly, for the
 * learner running the app in English and for whoever is helping them.
 */
export function FirstLanguagePicker({ value, onChange, label, inset = false }: Props) {
    return (
        <View accessibilityRole="radiogroup" accessibilityLabel={label}>
            {FIRST_LANGUAGES.map((language, index) => {
                const own = FIRST_LANGUAGE_LABELS[language];
                const english = FIRST_LANGUAGE_ENGLISH_NAMES[language];
                return (
                    <ListRow
                        key={language}
                        title={own}
                        // Filipino calls itself what English calls it, and a
                        // name repeated beside itself only reads as noise.
                        value={english === own ? undefined : english}
                        trailing="check"
                        inset={inset}
                        selected={language === value}
                        accessibilityRole="radio"
                        last={index === FIRST_LANGUAGES.length - 1}
                        onPress={() => onChange(language)}
                    />
                );
            })}
        </View>
    );
}
