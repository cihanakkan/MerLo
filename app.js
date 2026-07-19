{
  "rules": {
    "users": {
      "$uid": {
        ".read": "auth != null",
        ".write": "auth != null && auth.uid === $uid"
      }
    },
    "status": {
      "$uid": {
        ".read": "auth != null",
        ".write": "auth != null && auth.uid === $uid"
      }
    },
    "usernames": {
      ".read": "auth != null",
      "$username": {
        ".write": "auth != null"
      }
    },
    "friends": {
      "$uid": {
        ".read": "auth != null && auth.uid === $uid",
        "$friendUid": {
          ".write": "auth != null && (auth.uid === $uid || auth.uid === $friendUid)"
        }
      }
    },
    "friendRequests": {
      "$uid": {
        ".read": "auth != null && auth.uid === $uid",
        "$fromUid": {
          ".write": "auth != null && (auth.uid === $uid || auth.uid === $fromUid)"
        }
      }
    },
    "dms": {
      "$dmKey": {
        ".read": "auth != null && $dmKey.contains(auth.uid)",
        ".write": "auth != null && $dmKey.contains(auth.uid)"
      }
    },
    "servers": {
      ".read": "auth != null",
      ".indexOn": ["inviteCode"],
      "$serverId": {
        ".write": "auth != null",
        "channels": {
          "$channelId": {
            "messages": {
              "$messageId": {
                ".write": "auth != null && (!data.exists() || data.child('userId').val() === auth.uid)"
              }
            },
            "typing": {
              "$uid": {
                ".write": "auth != null && auth.uid === $uid"
              }
            },
            "voiceMembers": {
              "$uid": {
                ".write": "auth != null && auth.uid === $uid"
              }
            },
            "rtc": {
              ".write": "auth != null"
            }
          }
        }
      }
    }
  }
}
