// Google Workspace API helpers (Client-Side REST calls)

// Helper for encoding UTF-8 string to base64url (web-safe base64)
const base64urlEncode = (str: string): string => {
  try {
    const encoded = encodeURIComponent(str).replace(/%([0-9A-F]{2})/g, (_, p1) => {
      return String.fromCharCode(parseInt(p1, 16));
    });
    return window.btoa(encoded)
      .replace(/\+/g, '-')
      .replace(/\//g, '_')
      .replace(/=+$/, '');
  } catch (err) {
    console.error("Base64 encoding error:", err);
    return "";
  }
};

interface DocsResponse {
  documentId: string;
  title: string;
}

interface SpacesResponse {
  spaces: Array<{
    name: string;
    displayName?: string;
    singleUserBotDm?: boolean;
    spaceType?: string;
  }>;
}

export interface WorkspaceLetter {
  id: string;
  snippet: string;
  subject?: string;
  from?: string;
  to?: string;
  date?: string;
  body?: string;
}

// ================= DOCS API =================

// Create a new Google Document for the love journal
export const createJournalDoc = async (accessToken: string, title: string): Promise<DocsResponse> => {
  const res = await fetch('https://docs.googleapis.com/v1/documents', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${accessToken}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({ title })
  });
  
  if (!res.ok) {
    const errText = await res.text();
    throw new Error(`Docs creation failed: ${errText}`);
  }
  return await res.json();
};

// Retrieve Document content
export const getJournalContent = async (accessToken: string, documentId: string): Promise<string> => {
  const res = await fetch(`https://docs.googleapis.com/v1/documents/${documentId}`, {
    headers: { 'Authorization': `Bearer ${accessToken}` }
  });
  
  if (!res.ok) {
    const errText = await res.text();
    throw new Error(`Docs get failed: ${errText}`);
  }
  
  const doc = await res.json();
  let fullText = "";
  if (doc.body && doc.body.content) {
    doc.body.content.forEach((element: any) => {
      if (element.paragraph && element.paragraph.elements) {
        element.paragraph.elements.forEach((inline: any) => {
          if (inline.textRun && inline.textRun.content) {
            fullText += inline.textRun.content;
          }
        });
      }
    });
  }
  return fullText;
};

// Append raw entry to document
export const appendJournalEntry = async (
  accessToken: string,
  documentId: string,
  entryText: string
): Promise<void> => {
  const res = await fetch(`https://docs.googleapis.com/v1/documents/${documentId}:batchUpdate`, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${accessToken}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      requests: [
        {
          insertText: {
            text: entryText,
            endOfSegmentLocation: {} // Appends to the end of the document
          }
        }
      ]
    })
  });
  
  if (!res.ok) {
    const errText = await res.text();
    throw new Error(`Docs append failed: ${errText}`);
  }
};


// ================= GMAIL API =================

// Send beautiful love letter via Gmail
export const sendEmailLoveLetter = async (
  accessToken: string,
  to: string,
  subject: string,
  htmlContent: string
): Promise<any> => {
  // Construct a standard RFC 2822 email message
  const emailLines = [
    `To: ${to}`,
    `Subject: =?UTF-8?B?${base64urlEncode(subject)}?=`,
    `MIME-Version: 1.0`,
    `Content-Type: text/html; charset=UTF-8`,
    `Content-Transfer-Encoding: 7bit`,
    ``,
    htmlContent
  ].join('\r\n');

  const raw = base64urlEncode(emailLines);

  const res = await fetch('https://gmail.googleapis.com/gmail/v1/users/me/messages/send', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${accessToken}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({ raw })
  });

  if (!res.ok) {
    const errText = await res.text();
    throw new Error(`Gmail send failed: ${errText}`);
  }
  return await res.json();
};

// List love letters in Gmail
export const listLoveLetters = async (accessToken: string, query: string = 'subject:("💌")'): Promise<WorkspaceLetter[]> => {
  const res = await fetch(`https://gmail.googleapis.com/gmail/v1/users/me/messages?q=${encodeURIComponent(query)}&maxResults=10`, {
    headers: { 'Authorization': `Bearer ${accessToken}` }
  });

  if (!res.ok) {
    const errText = await res.text();
    throw new Error(`Gmail list failed: ${errText}`);
  }

  const data = await res.json();
  if (!data.messages) return [];

  const letters: WorkspaceLetter[] = [];
  
  // Resolve details for matching messages
  for (const msg of data.messages) {
    try {
      const detail = await fetchLetterDetails(accessToken, msg.id);
      letters.push(detail);
    } catch (e) {
      console.error("Error fetching message details for ID:", msg.id, e);
    }
  }
  return letters;
};

// Get details of an individual email
export const fetchLetterDetails = async (accessToken: string, messageId: string): Promise<WorkspaceLetter> => {
  const res = await fetch(`https://gmail.googleapis.com/gmail/v1/users/me/messages/${messageId}`, {
    headers: { 'Authorization': `Bearer ${accessToken}` }
  });

  if (!res.ok) {
    throw new Error(`Gmail fetch message ${messageId} failed`);
  }

  const msg = await res.json();
  const headers = msg.payload?.headers || [];
  
  const getHeader = (name: string) => {
    return headers.find((h: any) => h.name.toLowerCase() === name.toLowerCase())?.value || "";
  };

  const subject = getHeader('subject');
  const from = getHeader('from');
  const to = getHeader('to');
  const date = getHeader('date');

  // Attempt to parse body
  let body = "";
  if (msg.payload) {
    if (msg.payload.body?.data) {
      body = decodeBase64Url(msg.payload.body.data);
    } else if (msg.payload.parts) {
      const htmlPart = msg.payload.parts.find((part: any) => part.mimeType === "text/html");
      const textPart = msg.payload.parts.find((part: any) => part.mimeType === "text/plain");
      const chosenPart = htmlPart || textPart || msg.payload.parts[0];
      if (chosenPart && chosenPart.body?.data) {
        body = decodeBase64Url(chosenPart.body.data);
      }
    }
  }

  return {
    id: msg.id,
    snippet: msg.snippet || "",
    subject,
    from,
    to,
    date,
    body: body || msg.snippet || ""
  };
};

// Base64url decoder helper
const decodeBase64Url = (base64url: string): string => {
  try {
    let base64 = base64url.replace(/-/g, '+').replace(/_/g, '/');
    while (base64.length % 4) {
      base64 += '=';
    }
    const binary = window.atob(base64);
    // Decode UTF-8 correctly
    return decodeURIComponent(
      binary
        .split('')
        .map((c) => '%' + ('00' + c.charCodeAt(0).toString(16)).slice(-2))
        .join('')
    );
  } catch (err) {
    console.error("Base64 URL decode error:", err);
    return "";
  }
};


// ================= GOOGLE CHAT API =================

// List active Google Chat spaces the user has joined
export const listChatSpaces = async (accessToken: string): Promise<SpacesResponse> => {
  const res = await fetch('https://chat.googleapis.com/v1/spaces', {
    headers: { 'Authorization': `Bearer ${accessToken}` }
  });

  if (!res.ok) {
    const errText = await res.text();
    throw new Error(`Chat list spaces failed: ${errText}`);
  }
  return await res.json();
};

// Send message to Google Chat space
export const sendChatMessage = async (
  accessToken: string,
  spaceName: string,
  text: string
): Promise<any> => {
  const res = await fetch(`https://chat.googleapis.com/v1/${spaceName}/messages`, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${accessToken}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({ text })
  });

  if (!res.ok) {
    const errText = await res.text();
    throw new Error(`Chat post message failed: ${errText}`);
  }
  return await res.json();
};
