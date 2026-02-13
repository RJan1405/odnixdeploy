# Quick Start: Testing the Report Feature

## 🚀 How to Test Right Now

### **Step 1: Open Your App**
Your servers are already running:
- Frontend: `http://localhost:5173`
- Backend: `http://localhost:8000`

### **Step 2: Test Report Submission**

1. **Find any post or omzo in your feed**
2. **Click the "..." (three dots) menu** in the top-right of the post
3. **Click "Report"**
4. **Select a reason** (e.g., "Spam")
5. **Click "Submit Report"**
6. **See the success message!** ✅

### **Step 3: Check Notifications**

1. **Log in as the content owner** (the person who posted)
2. **Click the notification bell** 🔔
3. **You should see**: "[Username] reported your post for [reason]"

---

## 🎨 What You'll See

### **Report Modal**:
```
┌─────────────────────────────────────┐
│  🚩 Report Post                  ✕  │
│  Help us keep the community safe    │
├─────────────────────────────────────┤
│                                     │
│  Why are you reporting this post?   │
│                                     │
│  ○ Spam                             │
│    Repetitive or misleading content │
│                                     │
│  ○ Inappropriate Content            │
│    Offensive or unsuitable material │
│                                     │
│  ○ Harassment or Bullying           │
│    Targeting or attacking others    │
│                                     │
│  ... (more options)                 │
│                                     │
│  [Cancel]  [Submit Report]          │
└─────────────────────────────────────┘
```

### **Copyright Report** (when selected):
```
┌─────────────────────────────────────┐
│  ⚠️  Please provide details about   │
│      the copyright infringement     │
│                                     │
│  Copyright Type:                    │
│  ○ Audio Copyright                  │
│  ○ Content Copyright                │
│  ○ Both Audio and Content           │
│                                     │
│  Copyright Details:                 │
│  ┌─────────────────────────────┐   │
│  │ Describe the copyrighted... │   │
│  └─────────────────────────────┘   │
│                                     │
│  ☑ Disable audio for this omzo      │
└─────────────────────────────────────┘
```

### **Success State**:
```
┌─────────────────────────────────────┐
│                                     │
│           ✓                         │
│      Report Submitted               │
│                                     │
│  Thank you for helping us maintain  │
│  a safe community. We'll review     │
│  this report shortly.               │
│                                     │
└─────────────────────────────────────┘
```

---

## 🔔 Notification Example

When someone reports your content, you'll see:

```
┌─────────────────────────────────────┐
│  Notifications                      │
├─────────────────────────────────────┤
│  👤  test1 reported your post for   │
│      spam                      🚩   │
│      2 minutes ago                  │
├─────────────────────────────────────┤
│  👤  test1 liked your omzo     ❤️   │
│      8 minutes ago                  │
└─────────────────────────────────────┘
```

---

## 🧪 Test Scenarios

### **Scenario 1: Basic Report**
1. User A posts a scribe
2. User B reports it for "Spam"
3. ✅ User A gets notification
4. ✅ Report appears in admin panel

### **Scenario 2: Copyright Report**
1. User A uploads an omzo
2. User B reports for "Copyright Infringement"
3. User B selects "Audio Copyright"
4. User B checks "Disable audio"
5. ✅ Omzo audio is muted
6. ✅ User A gets notification with copyright details

### **Scenario 3: Duplicate Prevention**
1. User B reports User A's post
2. User B tries to report same post again
3. ✅ Error: "You have already reported this post"

### **Scenario 4: Self-Report Prevention**
1. User A tries to report their own post
2. ✅ Error: "You cannot report your own post"

---

## 🎯 Quick Commands

### **View Reports in Admin**:
```
http://localhost:8000/admin/chat/postreport/
http://localhost:8000/admin/chat/omzoreport/
```

### **Check WebSocket Connection**:
Open browser console (F12) and look for:
```
✅ Notification WebSocket connected
📨 Notification received: {type: 'post_report', ...}
```

---

## 🐛 Troubleshooting

### **Modal doesn't open?**
- Check browser console for errors
- Ensure React is rendering properly
- Try refreshing the page

### **Report doesn't submit?**
- Check network tab for API errors
- Ensure backend is running
- Check if you selected a reason

### **Notification doesn't appear?**
- Check WebSocket connection in console
- Refresh the notification dropdown
- Ensure you're logged in as content owner

---

## 🎉 You're All Set!

The report feature is fully functional and ready to use. Try it out and see the beautiful UI in action! 🚀
