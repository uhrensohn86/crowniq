// Crowniq is a local, single-user application. This stable ID is used only
// as an internal owner key for the existing local data model and image paths.
export const LOCAL_USER_ID = "local-user";

export function useLocalUser() {
  return { id: LOCAL_USER_ID } as const;
}
