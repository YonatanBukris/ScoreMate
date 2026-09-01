import { GameTemplate } from './index';
import { DEFAULT_CUSTOM_RULES } from '../utils/rules';

/**
 * Built-in game templates. `custom` is a blank standard-style game the user
 * fully configures at setup time.
 */
export const GAME_TEMPLATES: GameTemplate[] = [
  {
    id: 'standard',
    nameKey: 'template.standard',
    descriptionKey: 'template.standardDesc',
    winCondition: 'highest',
    quickButtons: [1, 5, 10, -1],
  },
  {
    id: 'skat',
    nameKey: 'template.skat',
    descriptionKey: 'template.skatDesc',
    winCondition: 'highest',
    quickButtons: [18, 20, 24, -18],
  },
  {
    id: 'rummy',
    nameKey: 'template.rummy',
    descriptionKey: 'template.rummyDesc',
    // Rummy is typically played with points counting up as penalties; the
    // lowest score wins.
    winCondition: 'lowest',
    quickButtons: [5, 10, 25, -5],
    targetScore: 100,
  },
  {
    id: 'custom',
    nameKey: 'template.custom',
    descriptionKey: 'template.customDesc',
    winCondition: 'highest',
    quickButtons: [...DEFAULT_CUSTOM_RULES.quickButtons],
  },
];

export function getTemplate(id: string): GameTemplate {
  return GAME_TEMPLATES.find((t) => t.id === id) ?? GAME_TEMPLATES[0];
}
