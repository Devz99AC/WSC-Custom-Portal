import { render, screen } from "@testing-library/react";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { describe, expect, it } from "vitest";
import { LEARNING_VIDEOS } from "../content/learning-center";
import { LearningCenterPage } from "./LearningCenterPage";

const renderAt = (path: string) =>
  render(
    <MemoryRouter
      initialEntries={[path]}
      future={{ v7_startTransition: true, v7_relativeSplatPath: true }}
    >
      <Routes>
        <Route path="/learning" element={<LearningCenterPage />} />
        <Route path="/learning/:slug" element={<LearningCenterPage />} />
      </Routes>
    </MemoryRouter>,
  );

const [firstVideo] = LEARNING_VIDEOS;

describe("LearningCenterPage", () => {
  it("lists every video as an index, with no player mounted", () => {
    renderAt("/learning");

    for (const video of LEARNING_VIDEOS) {
      expect(screen.getByText(video.title)).toBeInTheDocument();
    }
    // Each embed costs megabytes of third-party script — the index must stay a list.
    expect(document.querySelectorAll("iframe")).toHaveLength(0);
  });

  it("expands only the video named in the URL, in place", () => {
    expect(firstVideo).toBeDefined();
    renderAt(`/learning/${firstVideo!.slug}`);

    const frames = document.querySelectorAll("iframe");
    expect(frames).toHaveLength(1);
    expect(frames[0]).toHaveAttribute(
      "src",
      `https://www.youtube-nocookie.com/embed/${firstVideo!.youtubeId}?rel=0`,
    );
    // The rest of the index stays on screen, so the next video is one click away.
    for (const video of LEARNING_VIDEOS) {
      expect(screen.getByText(video.title)).toBeInTheDocument();
    }
  });

  it("titles the frame so a screen reader announces which video it landed on", () => {
    renderAt(`/learning/${firstVideo!.slug}`);
    expect(screen.getByTitle(firstVideo!.title).tagName).toBe("IFRAME");
  });

  it("marks the open row expanded and points it back at the closed index", () => {
    renderAt(`/learning/${firstVideo!.slug}`);

    const rows = screen.getAllByRole("link", { expanded: false });
    expect(rows).toHaveLength(LEARNING_VIDEOS.length - 1);

    const open = screen.getByRole("link", { expanded: true });
    expect(open).toHaveAttribute("href", "/learning");
    expect(screen.getByRole("link", { name: "Close video" })).toHaveAttribute(
      "href",
      "/learning",
    );
  });

  it("links each closed row to its own shareable URL", () => {
    renderAt("/learning");
    for (const video of LEARNING_VIDEOS) {
      expect(screen.getByText(video.title).closest("a")).toHaveAttribute(
        "href",
        `/learning/${video.slug}`,
      );
    }
  });

  it("falls back to the index when a shared link points at a video that is gone", () => {
    renderAt("/learning/retired-video");

    expect(screen.getByText(/isn't available anymore/)).toBeInTheDocument();
    expect(document.querySelectorAll("iframe")).toHaveLength(0);
    expect(screen.getByText(LEARNING_VIDEOS[0]!.title)).toBeInTheDocument();
  });

  it("leaves thumbnails out of the accessibility tree — the title already says it", () => {
    renderAt("/learning");
    expect(screen.queryAllByRole("img")).toHaveLength(0);
    expect(document.querySelectorAll("img.lc-thumb")).toHaveLength(LEARNING_VIDEOS.length);
  });
});
