import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { StatCard } from "@/components/StatCard";

describe("StatCard", () => {
  it("renders the provided values", () => {
    render(<StatCard title="Average NDVI" value="0.523" hint="Mean value" />);
    expect(screen.getByText("Average NDVI")).toBeInTheDocument();
    expect(screen.getByText("0.523")).toBeInTheDocument();
    expect(screen.getByText("Mean value")).toBeInTheDocument();
  });
});

