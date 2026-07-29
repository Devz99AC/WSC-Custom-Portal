import { useEffect, useRef } from "react";
import { Link, useParams } from "react-router-dom";
import {
  LEARNING_VIDEOS,
  findLearningVideo,
  youTubeEmbedUrl,
  youTubeThumbnailUrl,
} from "../content/learning-center";

/**
 * "Learning Center" — an index that expands the player in place, never a separate detail
 * page. With a handful of short videos, sending the client to their own page costs three
 * interactions (open → watch → back) to reach the second video instead of one, and adds a
 * second way "back" that competes with the browser's own.
 *
 * The open video still lives in the URL (`/learning/<slug>`) rather than in component
 * state, which buys back the only thing a detail page had going for it: support can send a
 * client a link straight to one video, and the browser's back button closes the player.
 * Closing REPLACES the entry so a deep-linked visitor isn't bounced out of the portal.
 *
 * The iframe is mounted only while open — each YouTube embed pulls megabytes of
 * third-party script, and mounting all of them to show a list of titles is a page nobody
 * would wait for on a phone.
 */
export function LearningCenterPage() {
  const { slug } = useParams<{ slug: string }>();
  const openVideo = findLearningVideo(slug);
  const panelRef = useRef<HTMLDivElement>(null);

  // Opening the last item in a long list puts the player below the fold; nudge it into
  // view. "nearest" so an already-visible player doesn't jump.
  useEffect(() => {
    panelRef.current?.scrollIntoView({ block: "nearest" });
  }, [openVideo?.slug]);

  return (
    <>
      <div className="topbar">
        <div>
          <h2 className="disp">Learning Center</h2>
          <p>Short videos about how the process works</p>
        </div>
      </div>

      {slug !== undefined && openVideo === null && (
        <p className="statusnote">
          That video link isn&apos;t available anymore — pick one from the list below.
        </p>
      )}

      {LEARNING_VIDEOS.length === 0 ? (
        <div className="card">
          <p className="statusnote">
            No videos have been published yet — this is where your team&apos;s walkthroughs
            will appear.
          </p>
        </div>
      ) : (
        <div className="card lc-list">
          {LEARNING_VIDEOS.map((video) => {
            const isOpen = openVideo?.slug === video.slug;
            const panelId = `lc-panel-${video.slug}`;

            return (
              <article key={video.slug} className={`lc-item${isOpen ? " on" : ""}`}>
                <Link
                  className="lc-head"
                  to={isOpen ? "/learning" : `/learning/${video.slug}`}
                  replace={isOpen}
                  aria-expanded={isOpen}
                  aria-controls={isOpen ? panelId : undefined}
                >
                  {/* Decorative: the title sits right next to it, so alt text would just
                      make a screen reader read the same line twice. */}
                  <img
                    className="lc-thumb"
                    src={youTubeThumbnailUrl(video.youtubeId)}
                    alt=""
                    loading="lazy"
                    width={112}
                    height={63}
                  />
                  <span className="lc-meta">
                    <span className="lc-tag">{video.tag}</span>
                    <span className="lc-title">{video.title}</span>
                    {video.summary !== null && <span className="lc-sum">{video.summary}</span>}
                  </span>
                  <span className="lc-toggle" aria-hidden="true">
                    {isOpen ? "−" : "+"}
                  </span>
                </Link>

                {isOpen && (
                  <div className="lc-panel" id={panelId} ref={panelRef}>
                    <div className="lc-frame">
                      <iframe
                        src={youTubeEmbedUrl(video.youtubeId)}
                        title={video.title}
                        allow="clipboard-write; encrypted-media; picture-in-picture; web-share"
                        allowFullScreen
                      />
                    </div>
                    <Link className="lc-close" to="/learning" replace>
                      Close video
                    </Link>
                  </div>
                )}
              </article>
            );
          })}
        </div>
      )}
    </>
  );
}
