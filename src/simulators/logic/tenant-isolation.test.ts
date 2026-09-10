import { describe, it, expect } from 'vitest';
import { buildSteps, outcome } from './tenant-isolation';

describe('tenant-isolation logic', () => {
  it('no isolation: the list leaks the other apartments and the attack returns 200', () => {
    expect(outcome('none', 'list', 'scope', 1)).toEqual({ rows: 9, leaked: 6, status: 200 });
    expect(outcome('none', 'attack', 'scope', 1)).toEqual({ rows: 1, leaked: 1, status: 200 });
  });
  it('global scope filters Eloquent queries and turns the attack into a 404', () => {
    expect(outcome('fix', 'list', 'scope', 1)).toEqual({ rows: 3, leaked: 0, status: 200 });
    expect(outcome('fix', 'attack', 'scope', 1).status).toBe(404);
    const sql = buildSteps('fix', 'list', 'scope', 2)[2].state.sql;
    expect(sql).toContain('tenant_id = 2');
  });
  it('a forgotten scope on a raw query leaks under the app-level scope but not under RLS or db-per-tenant', () => {
    expect(outcome('fix', 'forgot', 'scope', 1).leaked).toBe(6);
    expect(outcome('fix', 'forgot', 'rls', 1).leaked).toBe(0);
    expect(outcome('fix', 'forgot', 'db', 1).leaked).toBe(0);
  });
  it('RLS keeps the SQL unscoped but the policy filters; db-per-tenant switches the connection', () => {
    const rls = buildSteps('fix', 'list', 'rls', 3);
    expect(rls[1].state.policy).toContain("current_setting('app.tenant')");
    expect(outcome('fix', 'list', 'rls', 3)).toEqual({ rows: 3, leaked: 0, status: 200 });
    const db = buildSteps('fix', 'attack', 'db', 1);
    expect(db[1].state.connection).toBe('tenant_1');
    expect(outcome('fix', 'attack', 'db', 1).status).toBe(404);
  });
});
