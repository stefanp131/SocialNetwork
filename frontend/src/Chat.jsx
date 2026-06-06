import React, { useState, useEffect, useRef, useCallback } from 'react';
import axios from 'axios';

const API_URL = 'http://127.0.0.1:4000/api';
const CHAT_URL = API_URL + '/chat';
const POLL_INTERVAL = 2000;
const MAX_VISIBLE_DIALOGS = 4;

// --- Tiny avatar (self-contained so Chat.jsx has no circular dep on App.jsx) ---
function MiniAvatar({ userId, imageSrc, size }) {
  var sz = size || 24;
  if (imageSrc) {
    return (
      <img
        src={imageSrc}
        alt=""
        style={{
          width: sz,
          height: sz,
          borderRadius: '50%',
          objectFit: 'cover',
          border: '1px solid rgba(255,255,255,0.15)',
          flexShrink: 0,
        }}
      />
    );
  }
  return (
    <div
      style={{
        width: sz,
        height: sz,
        borderRadius: '50%',
        background: 'rgba(99,102,241,0.25)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        color: '#a5b4fc',
        fontWeight: 700,
        fontSize: Math.max(10, Math.floor(sz * 0.45)),
        border: '1px solid rgba(99,102,241,0.35)',
        flexShrink: 0,
      }}
    >
      {(userId || '?')[0].toUpperCase()}
    </div>
  );
}

// --- Sent / Seen tick icons ---
function StatusTick({ status }) {
  if (status === 'seen') {
    // Blue double-tick
    return (
      <span title="Seen" style={{ color: '#38bdf8', display: 'inline-flex', alignItems: 'center' }}>
        <svg width="14" height="9" viewBox="0 0 14 9" fill="none" xmlns="http://www.w3.org/2000/svg">
          <path d="M1 4.5L4.5 8L13 1" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
          <path d="M5 7.5L8.5 4" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" opacity="0.6" />
        </svg>
      </span>
    );
  }
  // Grey single-tick
  return (
    <span title="Sent" style={{ color: '#64748b', display: 'inline-flex', alignItems: 'center' }}>
      <svg width="10" height="9" viewBox="0 0 10 9" fill="none" xmlns="http://www.w3.org/2000/svg">
        <path d="M1 4.5L4 8L9 1" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
    </span>
  );
}

// --- Single conversation dialog card ---
function ChatDialog({ currentUsername, partnerId, partnerProfile, onClose, onDialogViewed }) {
  var [messages, setMessages] = useState([]);
  var [draft, setDraft] = useState('');
  var [isMinimised, setIsMinimised] = useState(false);
  var bottomRef = useRef(null);
  var inputRef = useRef(null);

  var fetchMessages = useCallback(function () {
    return axios
      .get(CHAT_URL + '/messages/' + currentUsername + '/' + partnerId)
      .then(function (res) {
        setMessages(res.data || []);
      })
      .catch(function (err) {
        // silent - poll will retry
      });
  }, [currentUsername, partnerId]);

  function markSeen() {
    return axios
      .patch(CHAT_URL + '/messages/seen', {
        viewerId: currentUsername,
        partnerId: partnerId,
      })
      .then(function () {
        if (typeof onDialogViewed === 'function') {
          onDialogViewed();
        }
        return fetchMessages();
      })
      .catch(function () {
        return null;
      });
  }

  useEffect(function () {
    fetchMessages();
    var id = setInterval(fetchMessages, POLL_INTERVAL);
    return function () { clearInterval(id); };
  }, [fetchMessages]);

  useEffect(function () {
    if (!isMinimised && bottomRef.current) {
      bottomRef.current.scrollIntoView({ behavior: 'smooth' });
    }
  }, [messages, isMinimised]);

  function sendMessage(e) {
    e.preventDefault();
    var text = draft.trim();
    if (!text) return;
    setDraft('');
    axios
      .post(CHAT_URL + '/messages', {
        senderId: currentUsername,
        receiverId: partnerId,
        text: text,
      })
      .then(function (res) {
        setMessages(function (prev) { return prev.concat([res.data]); });
        setTimeout(function () {
          if (bottomRef.current) bottomRef.current.scrollIntoView({ behavior: 'smooth' });
        }, 50);
      })
      .catch(function (err) {
        console.error('Send message error:', err);
      });
  }

  var displayName = (partnerProfile && partnerProfile.name) ? partnerProfile.name : partnerId;
  var profileImage = partnerProfile ? partnerProfile.profileImage : '';

  return (
    <div
      className={'chat-dialog' + (isMinimised ? ' chat-dialog--minimised' : '')}
      onMouseDown={function () {
        if (!isMinimised) {
          markSeen();
        }
      }}
    >
      <div
        className="chat-dialog-header"
        onClick={function () {
          setIsMinimised(function (v) {
            var next = !v;
            if (v && next) {
              markSeen();
            }
            return next;
          });
        }}
      >
        <MiniAvatar userId={partnerId} imageSrc={profileImage} size={26} />
        <div className="chat-dialog-header-meta">
          <span className="chat-dialog-name">{displayName}</span>
          <span className="chat-dialog-username">@{partnerId}</span>
        </div>
        <div className="chat-dialog-header-actions" onClick={function (e) { e.stopPropagation(); }}>
          <button
            className="chat-header-btn"
            onClick={function () {
              setIsMinimised(function (v) {
                var next = !v;
                if (v && next) {
                  markSeen();
                }
                return next;
              });
            }}
            title={isMinimised ? 'Expand' : 'Minimise'}
          >
            {isMinimised ? '\u25b2' : '\u25bc'}
          </button>
          <button className="chat-header-btn" onClick={onClose} title="Close">&times;</button>
        </div>
      </div>

      {!isMinimised && (
        <React.Fragment>
          <div className="chat-messages">
            {messages.length === 0 && (
              <div className="chat-empty">No messages yet. Say hi!</div>
            )}
            {messages.map(function (msg) {
              var isMine = msg.senderId === currentUsername;
              return (
                <div key={msg._id} className={'chat-bubble-row' + (isMine ? ' chat-bubble-row--mine' : '')}>
                  <div className={'chat-bubble' + (isMine ? ' chat-bubble--mine' : ' chat-bubble--theirs')}>
                    <span className="chat-bubble-text">{msg.text}</span>
                    {isMine && (
                      <span className="chat-bubble-status">
                        <StatusTick status={msg.status} />
                      </span>
                    )}
                  </div>
                </div>
              );
            })}
            <div ref={bottomRef} />
          </div>

          <form className="chat-input-row" onSubmit={sendMessage}>
            <input
              ref={inputRef}
              className="chat-input"
              placeholder={'Message ' + displayName + '...'}
              value={draft}
              onChange={function (e) { setDraft(e.target.value); }}
              onFocus={function () { markSeen(); }}
              autoComplete="off"
            />
            <button type="submit" className="chat-send-btn" disabled={!draft.trim()}>
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                <line x1="22" y1="2" x2="11" y2="13" />
                <polygon points="22 2 15 22 11 13 2 9 22 2" />
              </svg>
            </button>
          </form>
        </React.Fragment>
      )}
    </div>
  );
}

// --- Chat strip: manages the row of open dialog cards ---
function ChatStrip({ currentUsername, onUnreadChange }) {
  var [openDialogs, setOpenDialogs] = useState([]);
  var [partnerProfiles, setPartnerProfiles] = useState({});
  var latestIncomingByPartnerRef = useRef({});
  var overflowRef = useRef(null);

  var fetchProfile = useCallback(function (userId) {
    if (partnerProfiles[userId]) return Promise.resolve(partnerProfiles[userId]);
    return axios
      .get(API_URL + '/users/' + userId)
      .then(function (res) {
        var p = {
          name: (res.data && res.data.name) ? res.data.name : userId,
          profileImage: (res.data && res.data.profileImage) ? res.data.profileImage : '',
        };
        setPartnerProfiles(function (prev) {
          var next = Object.assign({}, prev);
          next[userId] = p;
          return next;
        });
        return p;
      })
      .catch(function (err) {
        return { name: userId, profileImage: '' };
      });
  }, [partnerProfiles]);

  useEffect(function () {
    function handler(e) {
      var partnerId = e.detail && e.detail.partnerId;
      if (!partnerId || partnerId === currentUsername) return;
      fetchProfile(partnerId).then(function () {
        setOpenDialogs(function (prev) {
          if (prev.some(function (d) { return d.partnerId === partnerId; })) return prev;
          return prev.concat([{ partnerId: partnerId }]);
        });
      });
    }
    window.addEventListener('chat:open', handler);
    return function () { window.removeEventListener('chat:open', handler); };
  }, [currentUsername, fetchProfile]);

  var refreshNotifications = useCallback(function () {
    if (!currentUsername) return;
    axios
      .get(CHAT_URL + '/notifications/' + currentUsername)
      .then(function (res) {
        if (typeof onUnreadChange === 'function') {
          onUnreadChange(res.data && typeof res.data.unreadTotal === 'number' ? res.data.unreadTotal : 0);
        }
      })
      .catch(function () {
        if (typeof onUnreadChange === 'function') {
          onUnreadChange(0);
        }
      });
  }, [currentUsername, onUnreadChange]);

  useEffect(function () {
    refreshNotifications();
    var id = setInterval(refreshNotifications, POLL_INTERVAL);
    return function () { clearInterval(id); };
  }, [refreshNotifications]);

  useEffect(function () {
    if (!currentUsername) return;

    function openOrFocusDialog(partnerId) {
      setOpenDialogs(function (prev) {
        if (prev.some(function (d) { return d.partnerId === partnerId; })) {
          var restExisting = prev.filter(function (d) { return d.partnerId !== partnerId; });
          return restExisting.concat([{ partnerId: partnerId }]);
        }
        return prev.concat([{ partnerId: partnerId }]);
      });
    }

    function pollIncoming() {
      axios
        .get(CHAT_URL + '/conversations/' + currentUsername)
        .then(function (res) {
          var conversations = res.data || [];
          conversations.forEach(function (conv) {
            var last = conv.lastMessage;
            if (!last) return;
            if (last.receiverId !== currentUsername) return;
            if (last.status !== 'sent') return;

            var partnerId = conv.partnerId;
            var lastKnownId = latestIncomingByPartnerRef.current[partnerId];
            if (lastKnownId !== last._id) {
              latestIncomingByPartnerRef.current[partnerId] = last._id;
              fetchProfile(partnerId);
              openOrFocusDialog(partnerId);
            }
          });
        })
        .catch(function () {
          return null;
        });
    }

    pollIncoming();
    var id = setInterval(pollIncoming, POLL_INTERVAL);
    return function () { clearInterval(id); };
  }, [currentUsername, fetchProfile]);

  function closeDialog(partnerId) {
    setOpenDialogs(function (prev) { return prev.filter(function (d) { return d.partnerId !== partnerId; }); });
  }

  function bringToFront(d) {
    setOpenDialogs(function (prev) {
      var rest = prev.filter(function (x) { return x.partnerId !== d.partnerId; });
      return rest.concat([d]);
    });
  }

  var visibleDialogs = openDialogs.slice(-MAX_VISIBLE_DIALOGS);
  var hiddenCount = Math.max(0, openDialogs.length - MAX_VISIBLE_DIALOGS);

  if (openDialogs.length === 0) return null;

  return (
    <div className="chat-strip">
      {hiddenCount > 0 && (
        <div className="chat-overflow-scroll" ref={overflowRef}>
          <div className="chat-overflow-label">{hiddenCount} more</div>
          <div className="chat-overflow-list">
            {openDialogs.slice(0, hiddenCount).map(function (d) {
              var profile = partnerProfiles[d.partnerId];
              return (
                <div
                  key={d.partnerId}
                  className="chat-overflow-chip"
                  onClick={function () { bringToFront(d); }}
                >
                  <MiniAvatar userId={d.partnerId} imageSrc={profile ? profile.profileImage : ''} size={20} />
                  <span>{profile ? profile.name : d.partnerId}</span>
                  <button
                    className="chat-overflow-close"
                    onClick={function (e) { e.stopPropagation(); closeDialog(d.partnerId); }}
                  >
                    &times;
                  </button>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {visibleDialogs.map(function (d) {
        return (
          <ChatDialog
            key={d.partnerId}
            currentUsername={currentUsername}
            partnerId={d.partnerId}
            partnerProfile={partnerProfiles[d.partnerId]}
            onClose={function () { closeDialog(d.partnerId); }}
            onDialogViewed={refreshNotifications}
          />
        );
      })}
    </div>
  );
}

export default ChatStrip;

// Helper callable from anywhere to open a chat dialog
export function openChat(partnerId) {
  window.dispatchEvent(new CustomEvent('chat:open', { detail: { partnerId: partnerId } }));
}
