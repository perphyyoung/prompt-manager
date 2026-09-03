import { describe, it, expect } from "vitest";
import { escapeLikePattern } from "../../src/utils/index.js";

describe("escapeLikePattern", () => {
  it("普通关键词原样返回", () => {
    expect(escapeLikePattern("风景")).toBe("风景");
    expect(escapeLikePattern("a-b 123")).toBe("a-b 123");
  });

  it("转义百分号，避免退化成匹配全部", () => {
    expect(escapeLikePattern("%")).toBe("\\%");
    expect(escapeLikePattern("50%off")).toBe("50\\%off");
  });

  it("转义下划线，避免匹配任意单字符", () => {
    expect(escapeLikePattern("_")).toBe("\\_");
    expect(escapeLikePattern("a_b")).toBe("a\\_b");
  });

  it("转义反斜杠自身，保证转义符不被吞掉", () => {
    expect(escapeLikePattern("\\")).toBe("\\\\");
    expect(escapeLikePattern("a\\%b")).toBe("a\\\\\\%b");
  });

  it("空字符串不产生转义符", () => {
    expect(escapeLikePattern("")).toBe("");
  });
});
