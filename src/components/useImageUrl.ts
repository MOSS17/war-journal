import { useEffect, useState } from 'react';
import { db } from '../db/db';

/** An object URL for a stored screenshot, revoked when the component unmounts. */
export function useImageUrl(id: string | undefined): string | undefined {
  const [url, setUrl] = useState<string>();
  useEffect(() => {
    if (!id) return;
    let alive = true;
    let made: string | undefined;
    db.images.get(id).then((img) => {
      if (!alive || !img) return;
      made = URL.createObjectURL(img.blob);
      setUrl(made);
    });
    return () => {
      alive = false;
      if (made) URL.revokeObjectURL(made);
      setUrl(undefined);
    };
  }, [id]);
  return url;
}
