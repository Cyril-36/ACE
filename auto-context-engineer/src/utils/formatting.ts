// Formatting and display utilities

export class FormattingUtils {
  static formatFileSize(bytes: number): string {
    const sizes = ["Bytes", "KB", "MB", "GB"];
    if (bytes === 0) return "0 Bytes";
    const i = Math.floor(Math.log(bytes) / Math.log(1024));
    return Math.round((bytes / Math.pow(1024, i)) * 100) / 100 + " " + sizes[i];
  }

  static formatDate(date: Date): string {
    return new Intl.DateTimeFormat("en-US", {
      year: "numeric",
      month: "short",
      day: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    }).format(date);
  }

  static formatTokenCount(count: number): string {
    if (count < 1000) return count.toString();
    if (count < 1000000) return (count / 1000).toFixed(1) + "K";
    return (count / 1000000).toFixed(1) + "M";
  }

  static truncateText(text: string, maxLength: number): string {
    if (text.length <= maxLength) return text;
    return text.substring(0, maxLength - 3) + "...";
  }

  static highlightSearchTerms(text: string, terms: string[]): string {
    let highlighted = text;
    terms.forEach((term) => {
      const regex = new RegExp(`(${term})`, "gi");
      highlighted = highlighted.replace(regex, "<mark>$1</mark>");
    });
    return highlighted;
  }

  static formatDuration(ms: number): string {
    if (ms < 1000) return `${ms}ms`;
    if (ms < 60000) return `${(ms / 1000).toFixed(1)}s`;
    return `${(ms / 60000).toFixed(1)}m`;
  }
}

// Export individual functions for convenience
export const formatBytes = FormattingUtils.formatFileSize.bind(FormattingUtils);
export const formatDuration = FormattingUtils.formatDuration.bind(FormattingUtils);
export const formatDate = FormattingUtils.formatDate.bind(FormattingUtils);
export const truncateText = FormattingUtils.truncateText.bind(FormattingUtils);
export const highlightText = FormattingUtils.highlightSearchTerms.bind(FormattingUtils);
