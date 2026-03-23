#!/usr/bin/env python3
"""
Gmail Manager - ניהול ג'ימייל מהטרמינל
שליחה, מחיקה, חיפוש, והעברה בין תיקיות

הוראות התקנה:
1. pip install google-auth google-auth-oauthlib google-api-python-client
2. צור פרויקט ב-Google Cloud Console: https://console.cloud.google.com
3. הפעל את Gmail API בפרויקט
4. צור OAuth 2.0 credentials (Desktop App) והורד את הקובץ כ-credentials.json
5. שים את credentials.json באותה תיקייה של הסקריפט
6. הרץ: python3 gmail_manager.py
"""

import os
import sys
import base64
from email.mime.text import MIMEText
from email.mime.multipart import MIMEMultipart

from google.auth.transport.requests import Request
from google.oauth2.credentials import Credentials
from google_auth_oauthlib.flow import InstalledAppFlow
from googleapiclient.discovery import build

SCOPES = [
    'https://www.googleapis.com/auth/gmail.modify',
    'https://www.googleapis.com/auth/gmail.send',
]

SCRIPT_DIR = os.path.dirname(os.path.abspath(__file__))
TOKEN_PATH = os.path.join(SCRIPT_DIR, 'token.json')
CREDS_PATH = os.path.join(SCRIPT_DIR, 'credentials.json')


def get_service():
    """מתחבר ל-Gmail API ומחזיר service object."""
    creds = None
    if os.path.exists(TOKEN_PATH):
        creds = Credentials.from_authorized_user_file(TOKEN_PATH, SCOPES)
    if not creds or not creds.valid:
        if creds and creds.expired and creds.refresh_token:
            creds.refresh(Request())
        else:
            if not os.path.exists(CREDS_PATH):
                print(f"שגיאה: לא נמצא קובץ {CREDS_PATH}")
                print("הורד את הקובץ מ-Google Cloud Console ושים אותו כאן.")
                sys.exit(1)
            flow = InstalledAppFlow.from_client_secrets_file(CREDS_PATH, SCOPES)
            creds = flow.run_local_server(port=0)
        with open(TOKEN_PATH, 'w') as f:
            f.write(creds.to_json())
    return build('gmail', 'v1', credentials=creds)


def search_emails(service, query, max_results=10):
    """חיפוש מיילים לפי query."""
    results = service.users().messages().list(
        userId='me', q=query, maxResults=max_results
    ).execute()
    messages = results.get('messages', [])
    if not messages:
        print("לא נמצאו תוצאות.")
        return []

    emails = []
    for msg in messages:
        detail = service.users().messages().get(
            userId='me', id=msg['id'], format='metadata',
            metadataHeaders=['From', 'Subject', 'Date']
        ).execute()
        headers = {h['name']: h['value'] for h in detail['payload']['headers']}
        email_info = {
            'id': msg['id'],
            'threadId': detail.get('threadId'),
            'from': headers.get('From', ''),
            'subject': headers.get('Subject', ''),
            'date': headers.get('Date', ''),
            'labels': detail.get('labelIds', []),
            'snippet': detail.get('snippet', ''),
        }
        emails.append(email_info)
        print(f"\n{'='*60}")
        print(f"  ID: {email_info['id']}")
        print(f"  מאת: {email_info['from']}")
        print(f"  נושא: {email_info['subject']}")
        print(f"  תאריך: {email_info['date']}")
        print(f"  תקציר: {email_info['snippet'][:80]}...")
    print()
    return emails


def read_email(service, msg_id):
    """קריאת מייל מלא."""
    msg = service.users().messages().get(userId='me', id=msg_id, format='full').execute()
    headers = {h['name']: h['value'] for h in msg['payload']['headers']}
    print(f"\nמאת: {headers.get('From', '')}")
    print(f"אל: {headers.get('To', '')}")
    print(f"נושא: {headers.get('Subject', '')}")
    print(f"תאריך: {headers.get('Date', '')}")
    print(f"{'='*60}")

    body = _extract_body(msg['payload'])
    print(body if body else "(אין תוכן טקסט)")
    return msg


def _extract_body(payload):
    """חילוץ גוף ההודעה מה-payload."""
    if payload.get('body', {}).get('data'):
        return base64.urlsafe_b64decode(payload['body']['data']).decode('utf-8', errors='replace')
    parts = payload.get('parts', [])
    for part in parts:
        if part['mimeType'] == 'text/plain' and part.get('body', {}).get('data'):
            return base64.urlsafe_b64decode(part['body']['data']).decode('utf-8', errors='replace')
    for part in parts:
        result = _extract_body(part)
        if result:
            return result
    return ''


def send_email(service, to, subject, body, cc=None, bcc=None):
    """שליחת מייל."""
    message = MIMEMultipart()
    message['to'] = to
    message['subject'] = subject
    if cc:
        message['cc'] = cc
    if bcc:
        message['bcc'] = bcc
    message.attach(MIMEText(body, 'plain'))

    raw = base64.urlsafe_b64encode(message.as_bytes()).decode()
    sent = service.users().messages().send(
        userId='me', body={'raw': raw}
    ).execute()
    print(f"מייל נשלח בהצלחה! ID: {sent['id']}")
    return sent


def delete_email(service, msg_id, permanent=False):
    """מחיקת מייל (העברה לפח או מחיקה לצמיתות)."""
    if permanent:
        service.users().messages().delete(userId='me', id=msg_id).execute()
        print(f"מייל {msg_id} נמחק לצמיתות.")
    else:
        service.users().messages().trash(userId='me', id=msg_id).execute()
        print(f"מייל {msg_id} הועבר לפח.")


def move_email(service, msg_id, add_labels=None, remove_labels=None):
    """העברת מייל בין תיקיות (הוספה/הסרה של תוויות)."""
    body = {}
    if add_labels:
        body['addLabelIds'] = add_labels
    if remove_labels:
        body['removeLabelIds'] = remove_labels
    result = service.users().messages().modify(
        userId='me', id=msg_id, body=body
    ).execute()
    print(f"מייל {msg_id} עודכן. תוויות: {result.get('labelIds', [])}")
    return result


def list_labels(service):
    """הצגת כל התוויות/תיקיות."""
    results = service.users().labels().list(userId='me').execute()
    labels = results.get('labels', [])
    print("\nתוויות זמינות:")
    print(f"{'='*40}")
    for label in sorted(labels, key=lambda x: x['name']):
        print(f"  {label['id']:30s} | {label['name']}")
    print()
    return labels


def mark_as_read(service, msg_id):
    """סימון מייל כנקרא."""
    move_email(service, msg_id, remove_labels=['UNREAD'])
    print(f"מייל {msg_id} סומן כנקרא.")


def mark_as_unread(service, msg_id):
    """סימון מייל כלא נקרא."""
    move_email(service, msg_id, add_labels=['UNREAD'])
    print(f"מייל {msg_id} סומן כלא נקרא.")


def archive_email(service, msg_id):
    """ארכוב מייל (הסרה מהאינבוקס)."""
    move_email(service, msg_id, remove_labels=['INBOX'])
    print(f"מייל {msg_id} אורכב.")


def interactive_menu(service):
    """תפריט אינטראקטיבי."""
    while True:
        print("\n" + "="*50)
        print("       Gmail Manager - ניהול ג'ימייל")
        print("="*50)
        print("  1. חיפוש מיילים")
        print("  2. קריאת מייל")
        print("  3. שליחת מייל")
        print("  4. מחיקת מייל (העברה לפח)")
        print("  5. מחיקה לצמיתות")
        print("  6. העברה לתיקייה / הוספת תווית")
        print("  7. הסרת תווית")
        print("  8. סימון כנקרא")
        print("  9. סימון כלא נקרא")
        print("  10. ארכוב")
        print("  11. הצגת תוויות")
        print("  0. יציאה")
        print("="*50)

        choice = input("\nבחר אפשרות: ").strip()

        if choice == '0':
            print("להתראות!")
            break
        elif choice == '1':
            q = input("מילות חיפוש (למשל: from:someone@gmail.com / is:unread): ")
            n = input("מספר תוצאות (ברירת מחדל 10): ").strip()
            search_emails(service, q, int(n) if n else 10)
        elif choice == '2':
            msg_id = input("הכנס Message ID: ").strip()
            read_email(service, msg_id)
        elif choice == '3':
            to = input("אל: ")
            subject = input("נושא: ")
            body = input("תוכן: ")
            cc = input("CC (ריק לדלג): ").strip() or None
            send_email(service, to, subject, body, cc=cc)
        elif choice == '4':
            msg_id = input("Message ID למחיקה: ").strip()
            delete_email(service, msg_id, permanent=False)
        elif choice == '5':
            msg_id = input("Message ID למחיקה לצמיתות: ").strip()
            confirm = input("בטוח? (כן/לא): ").strip()
            if confirm == 'כן':
                delete_email(service, msg_id, permanent=True)
            else:
                print("בוטל.")
        elif choice == '6':
            msg_id = input("Message ID: ").strip()
            label = input("שם תווית להוספה (למשל STARRED, או ID מותאם): ").strip()
            move_email(service, msg_id, add_labels=[label])
        elif choice == '7':
            msg_id = input("Message ID: ").strip()
            label = input("שם תווית להסרה: ").strip()
            move_email(service, msg_id, remove_labels=[label])
        elif choice == '8':
            msg_id = input("Message ID: ").strip()
            mark_as_read(service, msg_id)
        elif choice == '9':
            msg_id = input("Message ID: ").strip()
            mark_as_unread(service, msg_id)
        elif choice == '10':
            msg_id = input("Message ID: ").strip()
            archive_email(service, msg_id)
        elif choice == '11':
            list_labels(service)
        else:
            print("אפשרות לא חוקית.")


if __name__ == '__main__':
    print("מתחבר ל-Gmail API...")
    service = get_service()
    print("מחובר בהצלחה!")
    interactive_menu(service)
