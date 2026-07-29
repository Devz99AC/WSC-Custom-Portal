/**
 * Learning Center content.
 *
 * This is the ONLY place videos are declared — the page renders whatever is in this list,
 * in this order. Adding, reordering or removing a video is an edit to this file and
 * nothing else.
 *
 * It is static content authored by WSC, NOT Salesforce data, so it deliberately does not
 * go through the BFF: there is no record for it in the org and inventing one would put
 * marketing copy behind a governor limit for no benefit.
 *
 * ⚠️ PLACEHOLDER CONTENT (2026-07-29). These three are the videos the stakeholder pinned
 * to see the structure — pulled from WSC's own YouTube channel, titles taken verbatim from
 * YouTube's oEmbed API rather than written by hand. Two of them are client reviews and one
 * is a client story; none of them explains the post-sale process, which is what the
 * Learning Center is ultimately for (see CLAUDE.md §3). Expect the real list to replace
 * these entirely.
 */

export interface LearningVideo {
  /**
   * URL segment — `/learning/<slug>`. Support shares these links with clients, so changing
   * a slug breaks a link that is already out in the world. Treat them as permanent.
   */
  slug: string;
  title: string;
  /** Short eyebrow label describing what kind of video this is. */
  tag: string;
  /**
   * One line under the title. `null` when WSC hasn't written one — a summary is a claim
   * about what the video says, so it comes from them, never from us.
   */
  summary: string | null;
  youtubeId: string;
}

export const LEARNING_VIDEOS: readonly LearningVideo[] = [
  {
    slug: "alexandria-pasta-business",
    title: "Alexandria Buys a Wholesale Aged Shelf Corporation for her Pasta Business",
    tag: "Client story",
    summary: null,
    youtubeId: "QEdm_07QBRU",
  },
  {
    slug: "david-review",
    title: "David — WholesaleShelfCorporations.com Review",
    tag: "Client review",
    summary: null,
    youtubeId: "B7WH3tpGV90",
  },
  {
    slug: "carlos-lopez-review",
    title: "Carlos Lopez — WholesaleShelfCorporations.com Review",
    tag: "Client review",
    summary: null,
    youtubeId: "VqTjYumIDQo",
  },
];

export const findLearningVideo = (slug: string | undefined): LearningVideo | null =>
  LEARNING_VIDEOS.find((video) => video.slug === slug) ?? null;

/**
 * `youtube-nocookie.com` is YouTube's privacy-enhanced host: it holds off on the tracking
 * cookie until playback starts. `rel=0` keeps the end-screen suggestions inside WSC's own
 * channel instead of offering a competitor's video to a paying client.
 */
export const youTubeEmbedUrl = (youtubeId: string): string =>
  `https://www.youtube-nocookie.com/embed/${youtubeId}?rel=0`;

/** `mqdefault` is the true 16:9 still; `hqdefault` pads 4:3 with black bars. */
export const youTubeThumbnailUrl = (youtubeId: string): string =>
  `https://i.ytimg.com/vi/${youtubeId}/mqdefault.jpg`;
