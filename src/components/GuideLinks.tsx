import { Icon } from './icons';
import { useOverlay } from './overlay';
import { saveLibraryItem } from '../db/actions';
import { useLibrary } from '../db/hooks';
import type { FieldLink } from '../lib/guides';

function host(url: string) {
  try {
    return new URL(url).hostname.replace(/^www\./, '');
  } catch {
    return url;
  }
}

/** A guide link with a "Save to Library" button. */
export function GuideLinks({ links, category }: { links: FieldLink[]; category: string }) {
  const { toast } = useOverlay();
  const library = useLibrary();
  const saved = new Set(library?.map((i) => i.url));
  return (
    <ul className="guide-links">
      {links.map((l) => (
        <li key={l.url}>
          <a href={l.url} target="_blank" rel="noopener noreferrer">
            {l.title}
            <Icon.external size={13} />
          </a>
          <span className="help">{host(l.url)}</span>
          {library &&
            (saved.has(l.url) ? (
              <span className="help guide-save">In Library</span>
            ) : (
              <button
                type="button"
                className="linkbtn guide-save"
                aria-label={`Save ${l.title} to Library`}
                onClick={async () => {
                  await saveLibraryItem(undefined, {
                    kind: 'link',
                    title: l.title,
                    url: l.url,
                    body: '',
                    category,
                    tags: ['field guide'],
                    pinned: false,
                  });
                  toast(`Saved to Library: ${l.title}`);
                }}
              >
                + Save
              </button>
            ))}
        </li>
      ))}
    </ul>
  );
}
