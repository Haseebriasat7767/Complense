/** Control library index — single entry point for the domain layer. */
import { SOC2_CONTROLS } from './controls.soc2.js';
import { ISO27001_CONTROLS } from './controls.iso27001.js';
import { CONTROL_CATEGORIES, FRAMEWORKS } from './frameworks.js';
import type { ControlDefinition, FrameworkKey, RiskLevel } from './types.js';

export const CONTROL_LIBRARY: ControlDefinition[] = [...SOC2_CONTROLS, ...ISO27001_CONTROLS];

const byId = new Map(CONTROL_LIBRARY.map((control) => [control.id, control]));
const byCode = new Map(CONTROL_LIBRARY.map((control) => [control.code, control]));

export const CONTROLS_BY_FRAMEWORK: Record<FrameworkKey, ControlDefinition[]> = {
  soc2: SOC2_CONTROLS,
  iso27001: ISO27001_CONTROLS,
};

export function getControl(id: string): ControlDefinition | undefined {
  return byId.get(id);
}

export function getControlByCode(code: string): ControlDefinition | undefined {
  return byCode.get(code);
}

export function controlsForFramework(key: FrameworkKey): ControlDefinition[] {
  return CONTROLS_BY_FRAMEWORK[key] ?? [];
}

/** Categories that actually contain controls for a framework, in display order. */
export function categoriesForFramework(key: FrameworkKey): string[] {
  const present = new Set(controlsForFramework(key).map((control) => control.category));
  return CONTROL_CATEGORIES.filter((category) => present.has(category));
}

export function categoryCountsForFramework(key: FrameworkKey): Array<{ category: string; count: number }> {
  return categoriesForFramework(key).map((category) => ({
    category,
    count: controlsForFramework(key).filter((control) => control.category === category).length,
  }));
}

export const RISK_ORDER: Record<RiskLevel, number> = {
  critical: 0,
  high: 1,
  medium: 2,
  low: 3,
};

export const RISK_LABELS: Record<RiskLevel, string> = {
  critical: 'Critical',
  high: 'High',
  medium: 'Medium',
  low: 'Low',
};

export function frameworkControlCount(key: FrameworkKey): number {
  return controlsForFramework(key).length;
}

export function frameworkSummary() {
  return (Object.keys(FRAMEWORKS) as FrameworkKey[]).map((key) => ({
    ...FRAMEWORKS[key],
    controls: frameworkControlCount(key),
    categories: categoriesForFramework(key).length,
  }));
}
