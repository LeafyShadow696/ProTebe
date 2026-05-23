// --- Google Workspace API Helpers ---
// Built using direct REST endpoints that consume the in-memory OAuth token.

// 1. Google Calendar Integration
export interface CalendarEventInput {
  summary: string;
  description: string;
  startDate: string; // ISO date (YYYY-MM-DD or YYYY-MM-DDTHH:MM:SS)
  endDate: string;
}

export async function createGoogleCalendarEvent(token: string, event: CalendarEventInput) {
  // Support both full day date or dateTime
  const startField = event.startDate.includes('T') ? { dateTime: event.startDate } : { date: event.startDate };
  const endField = event.endDate.includes('T') ? { dateTime: event.endDate } : { date: event.endDate };

  const response = await fetch('https://www.googleapis.com/calendar/v3/calendars/primary/events', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${token}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      summary: event.summary,
      description: event.description,
      start: startField,
      end: endField,
      reminders: {
        useDefault: true,
      },
    }),
  });

  if (!response.ok) {
    const errorDetails = await response.text();
    throw new Error(`Failed to create Google Calendar event: ${response.status} - ${errorDetails}`);
  }

  return response.json();
}

export async function fetchGoogleCalendarEvents(token: string) {
  const response = await fetch('https://www.googleapis.com/calendar/v3/calendars/primary/events?maxResults=50&orderBy=startTime&singleEvents=true', {
    method: 'GET',
    headers: {
      'Authorization': `Bearer ${token}`,
    },
  });

  if (!response.ok) {
    throw new Error(`Failed to load Google Calendar events: ${response.status}`);
  }

  const data = await response.json();
  return data.items || [];
}


// 2. Google Docs Integration
export async function createGoogleDocWithContent(token: string, title: string, textContent: string) {
  // Step A: Create an empty Google Doc
  const createResponse = await fetch('https://www.googleapis.com/docs/v1/documents', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${token}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      title: title,
    }),
  });

  if (!createResponse.ok) {
    throw new Error(`Failed to create empty Google Doc: ${createResponse.status}`);
  }

  const document = await createResponse.json();
  const documentId = document.documentId;

  // Step B: Insert the love note/poem content into the document
  const updateResponse = await fetch(`https://www.googleapis.com/docs/v1/documents/${documentId}:batchUpdate`, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${token}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      requests: [
        {
          insertText: {
            text: textContent,
            endOfSegmentLocation: {}, // Insert at the beginning/end
          },
        },
      ],
    }),
  });

  if (!updateResponse.ok) {
    throw new Error(`Failed to populate Google Doc content: ${updateResponse.status}`);
  }

  return { documentId, url: `https://docs.google.com/document/d/${documentId}/edit` };
}


// 3. Google Drive Integration
export async function uploadBackupToDrive(token: string, filename: string, textContent: string) {
  const metadata = {
    name: filename,
    mimeType: 'text/plain',
  };

  const form = new FormData();
  form.append('metadata', new Blob([JSON.stringify(metadata)], { type: 'application/json' }));
  form.append('file', new Blob([textContent], { type: 'text/plain' }));

  const response = await fetch('https://www.googleapis.com/upload/drive/v3/files?uploadType=multipart', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${token}`,
    },
    body: form,
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`Failed to upload to Google Drive: ${response.status} - ${errorText}`);
  }

  return response.json();
}


// 4. Google Chat Integration
export interface ChatSpace {
  name: string; // resource name, e.g. "spaces/AAAA..."
  displayName: string;
  type: string;
}

export async function fetchGoogleChatSpaces(token: string): Promise<ChatSpace[]> {
  const response = await fetch('https://chat.googleapis.com/v1/spaces', {
    method: 'GET',
    headers: {
      'Authorization': `Bearer ${token}`,
    },
  });

  if (!response.ok) {
    // If the Chat API is not enabled yet or restricts listing, return empty
    console.warn(`Failed to fetch Google Chat Spaces: ${response.status}`);
    return [];
  }

  const data = await response.json();
  return data.spaces || [];
}

export async function postMessageToGoogleChat(token: string, spaceName: string, textMessage: string) {
  // spaceName is in format "spaces/{spaceId}"
  const response = await fetch(`https://chat.googleapis.com/${spaceName}/messages`, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${token}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      text: textMessage,
    }),
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`Failed to post to Google Chat: ${response.status} - ${errorText}`);
  }

  return response.json();
}


// 5. Google Contacts (People API) Integration
export interface GoogleContact {
  id: string;
  name: string;
  email: string;
  photoUrl: string;
}

export async function fetchGoogleContacts(token: string): Promise<GoogleContact[]> {
  const response = await fetch('https://people.googleapis.com/v1/people/me/connections?personFields=names,emailAddresses,photos&pageSize=100', {
    method: 'GET',
    headers: {
      'Authorization': `Bearer ${token}`,
    },
  });

  if (!response.ok) {
    console.warn(`Failed to fetch Google Contacts: ${response.status}`);
    return [];
  }

  const data = await response.json();
  const connections = data.connections || [];

  return connections.map((c: any) => {
    const id = c.resourceName || String(Math.random());
    const nameObj = c.names?.[0];
    const emailObj = c.emailAddresses?.[0];
    const photoObj = c.photos?.find((p: any) => p.metadata?.primary) || c.photos?.[0];

    return {
      id: id,
      name: nameObj?.displayName || 'Neznámý Kontakt',
      email: emailObj?.value || '',
      photoUrl: photoObj?.url || '',
    };
  });
}
