import {
  sanitizePostHogEvent,
  sanitizePostHogPath,
  sanitizePostHogUrl,
} from "./posthog";

jest.mock("posthog-js", () => ({
  init: jest.fn(),
  capture: jest.fn(),
  identify: jest.fn(),
  reset: jest.fn(),
}));

describe("PostHog privacy sanitizers", () => {
  test("removes dynamic ids from owner and guest routes", () => {
    expect(sanitizePostHogPath("/clients/acme-farm")).toBe("/clients/:id");
    expect(sanitizePostHogPath("/guest/app/equipment/tractor-7")).toBe("/guest/app/equipment/:id");
  });

  test("drops guest credentials and all URL query values", () => {
    expect(sanitizePostHogUrl("/guest?token=owner:secret"))
      .toBe(`${window.location.origin}/guest`);
    expect(sanitizePostHogUrl("/guest?owner=user-1&code=1234"))
      .toBe(`${window.location.origin}/guest`);
  });

  test("sanitizes captured URL properties without mutating the event", () => {
    const event = {
      event: "$pageview",
      properties: {
        $current_url: "https://example.com/guest/app/clients/private-name?token=secret",
        $referrer: "https://example.com/guest?owner=abc&code=1234",
        token: "secret",
        safe: "value",
      },
    };

    const result = sanitizePostHogEvent(event);

    expect(result.properties).toEqual({
      $current_url: "https://example.com/guest/app/clients/:id",
      $referrer: "https://example.com/guest",
      safe: "value",
    });
    expect(event.properties.token).toBe("secret");
  });
});
