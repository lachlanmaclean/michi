import { useState } from 'react';
import { v4 as uuid } from 'uuid';
import { DEFAULT_CROP, type CellRect, type ImagePlacement, type ImageSource } from '@/types/binder';
import { fileToDataUrl } from '@/utils/imageLoad';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';

interface Props {
  rect: CellRect;
  existingPlacement: ImagePlacement | null;
  onConfirm: (placement: ImagePlacement) => void;
  onRemove?: () => void;
  onCancel: () => void;
}

export function ImageAssignDialog({ rect, existingPlacement, onConfirm, onRemove, onCancel }: Props) {
  const [tab, setTab] = useState<'upload' | 'url'>(
    existingPlacement?.source.kind === 'url' ? 'url' : 'upload'
  );
  const [url, setUrl] = useState(existingPlacement?.source.kind === 'url' ? existingPlacement.source.url : '');
  const [preview, setPreview] = useState<ImageSource | null>(existingPlacement?.source ?? null);
  const [error, setError] = useState<string | null>(null);

  async function handleFile(file: File | undefined) {
    if (!file) return;
    try {
      const dataUrl = await fileToDataUrl(file);
      setPreview({ kind: 'upload', dataUrl, fileName: file.name });
      setError(null);
    } catch {
      setError('Could not read that file.');
    }
  }

  function handleUrlChange(value: string) {
    setUrl(value);
    setPreview(value ? { kind: 'url', url: value } : null);
  }

  function confirm() {
    if (!preview) {
      setError('Choose an image first.');
      return;
    }
    // Swapping the image source on an existing placement resets crop,
    // since scale/offset were tuned for the old image's framing.
    const cropChanged = existingPlacement && preview !== existingPlacement.source;
    onConfirm({
      id: existingPlacement?.id ?? uuid(),
      rect,
      source: preview,
      crop: existingPlacement && !cropChanged ? existingPlacement.crop : DEFAULT_CROP,
    });
  }

  const spanCols = rect.colEnd - rect.colStart + 1;
  const spanRows = rect.rowEnd - rect.rowStart + 1;

  return (
    <Dialog open onOpenChange={(open) => !open && onCancel()}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>
            {existingPlacement ? 'Edit image' : 'Assign image'} — {spanCols}×{spanRows}
          </DialogTitle>
        </DialogHeader>

        <Tabs value={tab} onValueChange={(v) => setTab(v as 'upload' | 'url')}>
          <TabsList className="grid w-full grid-cols-2">
            <TabsTrigger value="upload">Upload</TabsTrigger>
            <TabsTrigger value="url">Image URL</TabsTrigger>
          </TabsList>
          <TabsContent value="upload" className="pt-2">
            <Input type="file" accept="image/*" onChange={(e) => handleFile(e.target.files?.[0])} />
          </TabsContent>
          <TabsContent value="url" className="pt-2 flex flex-col gap-1.5">
            <Label htmlFor="image-url" className="sr-only">
              Image URL
            </Label>
            <Input
              id="image-url"
              type="text"
              placeholder="https://example.com/image.png"
              value={url}
              onChange={(e) => handleUrlChange(e.target.value)}
            />
          </TabsContent>
        </Tabs>

        {preview && (
          <div className="rounded-md overflow-hidden max-h-52 border border-border">
            <img
              src={preview.kind === 'upload' ? preview.dataUrl : preview.url}
              alt="preview"
              className="w-full h-full object-contain bg-muted"
            />
          </div>
        )}

        {error && <p className="text-sm text-destructive">{error}</p>}

        <DialogFooter className="gap-2 sm:gap-0">
          {onRemove && (
            <Button variant="destructive" className="sm:mr-auto" onClick={onRemove}>
              Remove
            </Button>
          )}
          <Button variant="outline" onClick={onCancel}>
            Cancel
          </Button>
          <Button onClick={confirm}>{existingPlacement ? 'Save' : 'Assign'}</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
