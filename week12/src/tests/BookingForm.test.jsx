import { render, screen } from "@testing-library/react";
import { describe, test, expect } from "vitest";
import BookingForm from "../components/BookingForm";

describe("BookingForm", () => {

  test("Search Flights button exists", () => {

    render(<BookingForm />);

    const button = screen.getByText(/Search Flights/i);

    expect(button).toBeDefined();

  });

});