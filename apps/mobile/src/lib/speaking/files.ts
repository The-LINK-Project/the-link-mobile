import { File, Paths } from "expo-file-system";

/** Deletes a local file if it is still there. Never throws. */
export function deleteFile(uri: string | null | undefined) {
    if (!uri) return;
    try {
        const file = new File(uri);
        if (file.exists) file.delete();
    } catch {
        // Already gone; the system clears the cache directory eventually anyway.
    }
}

/** Writes the tutor's reply to the cache so it can be played, and replayed. */
export function saveTutorAudio(base64: string, name: string): string | undefined {
    let createdUri: string | undefined;
    try {
        const file = new File(Paths.cache, `tutor-${name}.wav`);
        if (file.exists) file.delete();
        file.create();
        createdUri = file.uri;
        file.write(base64, { encoding: "base64" });
        return file.uri;
    } catch {
        deleteFile(createdUri);
        // The reply still shows as text; the learner just cannot hear it.
        return undefined;
    }
}
