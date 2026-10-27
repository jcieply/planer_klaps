import { describe, expect, it } from 'vitest';
import { focusOf } from '../../src/collab/session';
import { useUI } from '../../src/state/ui';

describe('miękka blokada: co ktoś ma otwarte', () => {
  const st = (p: object) => ({ ...useUI.getState(), ...p } as ReturnType<typeof useUI.getState>);
  it('scena w szufladzie ma pierwszeństwo, potem dzień planu pracy i otwarte wiersze', () => {
    expect(focusOf(st({ drawer: 's1', tab: 'board' }))).toEqual({ k: 'scene', id: 's1' });
    expect(focusOf(st({ drawer: null, tab: 'callsheet', csDay: 'd1' }))).toEqual({ k: 'day', id: 'd1' });
    expect(focusOf(st({ drawer: null, tab: 'crew', crewOpen: ['a', 'b'] }))).toEqual({ k: 'crew', id: 'b' });
    expect(focusOf(st({ drawer: null, tab: 'cast', castOpen: [3] }))).toEqual({ k: 'cast', id: '3' });
    expect(focusOf(st({ drawer: null, tab: 'sites', siteOpen: ['DOM'] }))).toEqual({ k: 'site', id: 'DOM' });
    expect(focusOf(st({ drawer: null, tab: 'budget' }))).toBeNull();
  });
});
