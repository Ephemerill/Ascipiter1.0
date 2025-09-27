import React, { useState } from 'react';
import html2canvas from 'html2canvas';

// Helper function to gather system information
const getSystemInfo = () => {
  const { userAgent, platform } = navigator;
  const { innerWidth, innerHeight, devicePixelRatio } = window;

  return `
**System Info:**
- **Browser:** ${userAgent}
- **Platform:** ${platform}
- **Viewport:** ${innerWidth}x${innerHeight}
- **Pixel Ratio:** ${devicePixelRatio}
  `.trim();
};

export default function FeedbackModal({ onClose, consoleLogs, showToast }) {
    const [feedbackText, setFeedbackText] = useState('');
    const [includeLogs, setIncludeLogs] = useState(true);
    const [includeScreenshot, setIncludeScreenshot] = useState(true);
    const [isSubmitting, setIsSubmitting] = useState(false);

    const handleSubmit = async (e) => {
        e.preventDefault();
        if (!feedbackText.trim() || isSubmitting) return;
        
        setIsSubmitting(true);

        // --- NEW LOGIC ---
        // 1. Immediately start the process of closing the modal.
        onClose();

        // 2. Wait for the modal to be removed from the DOM before proceeding.
        await new Promise(resolve => setTimeout(resolve, 100));

        const webhookUrl = "https://discord.com/api/webhooks/1421556787017945099/y7yJeGtSDG7YJT1cbJf9PrmL9PipbId5SOZZzeJW-Rx1oSzgIvHwpjSEC8Br9jM_deg9";
        const formData = new FormData();
        let messageContent = `**New Feedback:**\n>>> ${feedbackText}`;

        if (includeLogs) {
            messageContent += `\n\n${getSystemInfo()}`;
            if (consoleLogs && consoleLogs.length > 0) {
                messageContent += `\n\n**Console Logs (last 20):**\n\`\`\`json\n${consoleLogs.slice(-20).join('\n')}\n\`\`\``;
            }
        }

        if (includeScreenshot) {
            try {
                // 3. Now that the modal is gone, take a clean screenshot.
                const canvas = await html2canvas(document.body, {
                    useCORS: true,
                    allowTaint: true,
                    width: window.innerWidth,
                    height: window.innerHeight,
                    x: window.scrollX,
                    y: window.scrollY,
                });
                
                const blob = await new Promise(resolve => canvas.toBlob(resolve, 'image/png'));
                formData.append('file1', blob, 'screenshot.png');

            } catch (error) {
                console.error("Error taking screenshot:", error);
                messageContent += "\n\n**Error:** Could not capture screenshot.";
            }
        }
        
        formData.append('content', messageContent);
        
        try {
            const response = await fetch(webhookUrl, {
                method: 'POST',
                body: formData,
            });

            if (!response.ok) throw new Error(`Webhook failed with status: ${response.status}`);
            
            // 4. Show the success toast *after* everything is done.
            showToast('Feedback submitted!');

        } catch (error) {
            console.error('Error submitting feedback:', error);
            showToast('Submission failed. Please try again.');
        } 
        // No finally block needed as we don't need to manage the submit state anymore.
    };
    
    return (
        <div className="feedback-modal-content">
            <h3>Submit Feedback</h3>
            <form onSubmit={handleSubmit}>
                <textarea
                    placeholder="Tell us what you think or describe the issue..."
                    value={feedbackText}
                    onChange={(e) => setFeedbackText(e.target.value)}
                    rows={5}
                    disabled={isSubmitting}
                />
                <div className="feedback-options">
                    <label>
                        <input
                            type="checkbox"
                            checked={includeLogs}
                            onChange={(e) => setIncludeLogs(e.target.checked)}
                            disabled={isSubmitting}
                        />
                        Include System Info & Logs
                    </label>
                    <label>
                        <input
                            type="checkbox"
                            checked={includeScreenshot}
                            onChange={(e) => setIncludeScreenshot(e.target.checked)}
                            disabled={isSubmitting}
                        />
                        Include Screenshot 📸
                    </label>
                </div>
                <div className="feedback-actions">
                     <button type="button" onClick={onClose} disabled={isSubmitting}>Cancel</button>
                     <button type="submit" disabled={isSubmitting}>
                        {isSubmitting ? 'Sending...' : 'Submit'}
                    </button>
                </div>
            </form>
        </div>
    );
}