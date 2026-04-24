-- Make `reports` storage bucket private.
-- Previously public: any generated PDF (containing prospect PII + Claude analysis)
-- was world-readable via a guessable UUID path. This migration closes that.
--
-- After this: server code must issue short-TTL signed URLs to the owner only,
-- via /api/drafts/[id]/pdf.

update storage.buckets set public = false where id = 'reports';

drop policy if exists "Reports are publicly readable" on storage.objects;

-- Only the owning user can read their own objects (folder-0 = auth.uid()).
create policy "Users can read their own reports"
  on storage.objects for select
  using (bucket_id = 'reports' and auth.uid()::text = (storage.foldername(name))[1]);
