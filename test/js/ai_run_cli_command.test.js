import { describe, expect, it } from "vitest";
import { isReadOnly } from "../../src/js/ai/tools/runCliCommand";

describe("run_cli_command read/write classification", () => {
    it("treats query commands as read-only", () => {
        expect(isReadOnly("get gyro_lpf1_static_hz")).toBe(true);
        expect(isReadOnly("dump")).toBe(true);
        expect(isReadOnly("diff all")).toBe(true);
        expect(isReadOnly("status")).toBe(true);
        expect(isReadOnly("version")).toBe(true);
        expect(isReadOnly("tasks")).toBe(true);
    });

    it("treats `set name = value` as a write but `set name` as a read", () => {
        expect(isReadOnly("set anti_gravity_gain = 80")).toBe(false);
        expect(isReadOnly("set anti_gravity_gain")).toBe(true);
        expect(isReadOnly("set")).toBe(true);
    });

    it("treats bare listing verbs as read-only", () => {
        expect(isReadOnly("feature")).toBe(true);
        expect(isReadOnly("resource")).toBe(true);
        expect(isReadOnly("aux")).toBe(true);
        expect(isReadOnly("serial")).toBe(true);
    });

    it("treats listing verbs WITH config args as writes", () => {
        expect(isReadOnly("feature GPS")).toBe(false);
        expect(isReadOnly("resource MOTOR 1 A03")).toBe(false);
        expect(isReadOnly("aux 0 0 0 1700 2100 0 0")).toBe(false);
        expect(isReadOnly("profile 1")).toBe(false);
    });

    it("treats `<verb> list` as read-only", () => {
        expect(isReadOnly("resource list")).toBe(true);
        expect(isReadOnly("serial list")).toBe(true);
    });

    it("treats unknown / dangerous verbs as writes", () => {
        expect(isReadOnly("save")).toBe(false);
        expect(isReadOnly("defaults")).toBe(false);
        expect(isReadOnly("bl")).toBe(false);
        expect(isReadOnly("")).toBe(false);
    });
});
