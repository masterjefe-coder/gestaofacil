import test from "node:test";
import assert from "node:assert/strict";
import { getWorkspaceModuleCapabilities, getWorkspaceRoleLabel } from "@/lib/workspace-access";

test("member has operational billing access but not management", () => {
  const access = getWorkspaceModuleCapabilities("MEMBER", "billing");

  assert.equal(access.canView, true);
  assert.equal(access.canOperate, true);
  assert.equal(access.canManage, false);
});

test("member has read-only setup and fiscal access", () => {
  const setupAccess = getWorkspaceModuleCapabilities("MEMBER", "setup");
  const fiscalAccess = getWorkspaceModuleCapabilities("MEMBER", "fiscal");

  assert.equal(setupAccess.canView, true);
  assert.equal(setupAccess.canManage, false);
  assert.equal(fiscalAccess.canManage, false);
  assert.equal(fiscalAccess.canOperate, false);
});

test("admin keeps management powers on setup and fiscal", () => {
  const setupAccess = getWorkspaceModuleCapabilities("ADMIN", "setup");
  const fiscalAccess = getWorkspaceModuleCapabilities("ADMIN", "fiscal");

  assert.equal(setupAccess.canManage, true);
  assert.equal(setupAccess.canConfigure, true);
  assert.equal(fiscalAccess.canManage, true);
  assert.equal(fiscalAccess.canOperate, true);
});

test("getWorkspaceRoleLabel keeps dashboard copy human-friendly", () => {
  assert.equal(getWorkspaceRoleLabel("OWNER"), "Responsável");
  assert.equal(getWorkspaceRoleLabel("ADMIN"), "Gestão");
  assert.equal(getWorkspaceRoleLabel("MEMBER"), "Operação");
});
