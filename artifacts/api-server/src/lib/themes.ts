export interface ThemeDefinition {
  id: string;
  name: string;
  description: string;
  previewImageUrl: string;
  style: string;
  isDark: boolean;
  pages: string[];
}

export const THEMES: ThemeDefinition[] = [
  {
    id: "luminary",
    name: "Luminary",
    description: "Clean, airy, and modern — a bright minimal aesthetic with bold typography and generous whitespace.",
    previewImageUrl: "/api/themes/luminary/preview",
    style: "minimal-bright",
    isDark: false,
    pages: ["Home", "About", "Services", "Gallery", "Contact"],
  },
  {
    id: "obsidian",
    name: "Obsidian",
    description: "Dark, dramatic and sleek — premium dark-mode design with rich accents and smooth animations.",
    previewImageUrl: "/api/themes/obsidian/preview",
    style: "dark-premium",
    isDark: true,
    pages: ["Home", "About", "Services", "Gallery", "Contact"],
  },
  {
    id: "haven",
    name: "Haven",
    description: "Warm, welcoming and local — earthy tones and organic shapes perfect for food, wellness, and retail.",
    previewImageUrl: "/api/themes/haven/preview",
    style: "warm-organic",
    isDark: false,
    pages: ["Home", "About", "Services", "Gallery", "Contact"],
  },
];

export function getTheme(id: string): ThemeDefinition | undefined {
  return THEMES.find((t) => t.id === id);
}
