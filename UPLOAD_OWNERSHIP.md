# RouteAI upload ownership

- Any signed-in user can submit Quick Reports and geo-tagged photos.
- Every upload stores the authenticated uploader ID. Client-supplied userId/name fields are ignored by the backend.
- All signed-in users can view and search all uploads.
- Saved Data defaults to **My uploads**.
- Users can search their uploads, select multiple own uploads, and delete them.
- A normal user cannot delete another user's upload; the backend returns 403.
- Admin can delete any upload.
- Offline Quick Reports are stored locally under the current user's ID and sync when online.
