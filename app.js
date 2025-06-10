// DOM Elements
const videoCardContainer = document.querySelector(".video-container");
const toggleBtn = document.querySelector(".toggle-btn");
const navbar = document.querySelector(".navbar");
const sideBar = document.querySelector(".side-bar");
const searchInput = document.querySelector(".search-bar");
const searchBtn = document.querySelector(".search-btn");
const loadingSpinner = document.querySelector(".loading-spinner");

const API_KEY = "AIzaSyCYppk0giyBm_oLXsroPUq89UGqC81LIAM";
const VIDEO_API = "https://www.googleapis.com/youtube/v3/videos?";
const CHANNEL_API = "https://www.googleapis.com/youtube/v3/channels?";
const SEARCH_API = "https://www.googleapis.com/youtube/v3/search?";

let nextPageToken = "";
let isLoading = false;
let currentSearchQuery = "";

function debounce(func, delay) {
  let timeoutId;
  return function (...args) {
    clearTimeout(timeoutId);
    timeoutId = setTimeout(() => {
      func.apply(this, args);
    }, delay);
  };
}

function throttle(func, limit) {
  let lastFunc;
  let lastRan;
  return function (...args) {
    if (!lastRan) {
      func.apply(this, args);
      lastRan = Date.now();
    } else {
      clearTimeout(lastFunc);
      lastFunc = setTimeout(() => {
        if (Date.now() - lastRan >= limit) {
          func.apply(this, args);
          lastRan = Date.now();
        }
      }, limit - (Date.now() - lastRan));
    }
  };
}

toggleBtn.addEventListener("click", () => {
  navbar.classList.toggle("active");
});

document.addEventListener("click", (e) => {
  if (!sideBar.contains(e.target) && !toggleBtn.contains(e.target)) {
    navbar.classList.remove("active");
  }
});

function formatNumber(num) {
  if (num >= 1000000) {
    return (num / 1000000).toFixed(1) + "M";
  }
  if (num >= 1000) {
    return (num / 1000).toFixed(1) + "K";
  }
  return num.toString();
}

function formatDuration(duration) {
  const match = duration.match(/PT(\d+H)?(\d+M)?(\d+S)?/);
  const hours = (match[1] && match[1].slice(0, -1)) || "0";
  const minutes = (match[2] && match[2].slice(0, -1)) || "0";
  const seconds = (match[3] && match[3].slice(0, -1)) || "0";

  return `${hours.padStart(2, "0")}:${minutes.padStart(
    2,
    "0"
  )}:${seconds.padStart(2, "0")}`.replace(/^00:/, "");
}

function formatDate(publishedAt) {
  const now = new Date();
  const publishedDate = new Date(publishedAt);
  const diffInSeconds = Math.floor((now - publishedDate) / 1000);

  if (diffInSeconds < 60) return `${diffInSeconds} seconds ago`;
  if (diffInSeconds < 3600)
    return `${Math.floor(diffInSeconds / 60)} minutes ago`;
  if (diffInSeconds < 86400)
    return `${Math.floor(diffInSeconds / 3600)} hours ago`;
  if (diffInSeconds < 2592000)
    return `${Math.floor(diffInSeconds / 86400)} days ago`;
  if (diffInSeconds < 31536000)
    return `${Math.floor(diffInSeconds / 2592000)} months ago`;
  return `${Math.floor(diffInSeconds / 31536000)} years ago`;
}

async function fetchVideos() {
  try {
    if (isLoading) return;
    isLoading = true;
    loadingSpinner.style.display = "flex";

    const response = await fetch(
      VIDEO_API +
        new URLSearchParams({
          key: API_KEY,
          part: "snippet,contentDetails,statistics",
          chart: "mostPopular",
          maxResults: 12,
          regionCode: "US",
          pageToken: nextPageToken,
        })
    );

    const data = await response.json();
    nextPageToken = data.nextPageToken || "";

    data.items.forEach((item) => {
      getChannelDetails(item);
    });

    isLoading = false;
    loadingSpinner.style.display = "none";
  } catch (err) {
    console.error("Error fetching videos:", err);
    isLoading = false;
    loadingSpinner.style.display = "none";
    videoCardContainer.innerHTML = `<div class="error-message">Failed to load videos. Please try again later.</div>`;
  }
}

async function getChannelDetails(videoData) {
  try {
    const response = await fetch(
      CHANNEL_API +
        new URLSearchParams({
          key: API_KEY,
          part: "snippet",
          id: videoData.snippet.channelId,
        })
    );

    const data = await response.json();
    videoData.channelThumbnail = data.items[0].snippet.thumbnails.default.url;
    videoData.channelVerified = data.items[0].snippet.title.includes("✓");
    makeVideoCard(videoData);
  } catch (err) {
    console.error("Error fetching channel details:", err);
    videoData.channelThumbnail = "";
    videoData.channelVerified = false;
    makeVideoCard(videoData);
  }
}

function makeVideoCard(data) {
  const viewCount = formatNumber(data.statistics.viewCount);
  const publishedAt = formatDate(data.snippet.publishedAt);
  const duration = formatDuration(data.contentDetails.duration);

  videoCardContainer.innerHTML += `
    <div class="video" onclick="location.href = 'https://youtube.com/watch?v=${
      data.id
    }'">
      <div class="thumbnail-container">
        <img src="${
          data.snippet.thumbnails.medium.url
        }" class="thumbnail" alt="${data.snippet.title}">
        <span class="duration">${duration}</span>
      </div>
      <div class="video-content">
        <img src="${data.channelThumbnail}" class="channel-icon" alt="${
    data.snippet.channelTitle
  }">
        <div class="video-info">
          <h3 class="video-title">${data.snippet.title}</h3>
          <p class="channel-name">
            ${data.snippet.channelTitle}
            ${
              data.channelVerified
                ? '<i class="fa-solid fa-check-circle verified-icon"></i>'
                : ""
            }
          </p>
          <p class="video-stats">${viewCount} views • ${publishedAt}</p>
        </div>
      </div>
    </div>
  `;
}

const debouncedSearch = debounce(searchVideos, 500);

searchBtn.addEventListener("click", () => {
  const query = searchInput.value.trim();
  if (query) {
    currentSearchQuery = query;
    debouncedSearch(query);
  }
});

searchInput.addEventListener("input", () => {
  const query = searchInput.value.trim();
  if (query) {
    currentSearchQuery = query;
    debouncedSearch(query);
  }
});

searchInput.addEventListener("keypress", (e) => {
  if (e.key === "Enter" && searchInput.value.trim()) {
    const query = searchInput.value.trim();
    currentSearchQuery = query;
    searchVideos(query);
  }
});

async function searchVideos(query) {
  try {
    if (query !== currentSearchQuery) return;

    videoCardContainer.innerHTML = "";
    loadingSpinner.style.display = "flex";
    nextPageToken = "";

    const response = await fetch(
      SEARCH_API +
        new URLSearchParams({
          key: API_KEY,
          part: "snippet",
          maxResults: 12,
          q: query,
          type: "video",
        })
    );

    const data = await response.json();
    const videoIds = data.items.map((item) => item.id.videoId).join(",");

    const videoResponse = await fetch(
      VIDEO_API +
        new URLSearchParams({
          key: API_KEY,
          part: "snippet,contentDetails,statistics",
          id: videoIds,
        })
    );

    const videoData = await videoResponse.json();
    videoData.items.forEach((item) => {
      getChannelDetails(item);
    });

    loadingSpinner.style.display = "none";
  } catch (err) {
    console.error("Error searching videos:", err);
    loadingSpinner.style.display = "none";
    videoCardContainer.innerHTML = `<div class="error-message">Failed to search videos. Please try again later.</div>`;
  }
}

const throttledScroll = throttle(() => {
  if (
    window.innerHeight + window.scrollY >= document.body.offsetHeight - 500 &&
    !isLoading &&
    nextPageToken
  ) {
    if (currentSearchQuery) {
      searchVideos(currentSearchQuery);
    } else {
      fetchVideos();
    }
  }
}, 1000);

window.addEventListener("scroll", throttledScroll);

const filterButtons = document.querySelectorAll(".filter-options");
filterButtons.forEach((button) => {
  button.addEventListener("click", () => {
    filterButtons.forEach((btn) => btn.classList.remove("active"));
    button.classList.add("active");
    videoCardContainer.innerHTML = "";
    nextPageToken = "";
    currentSearchQuery = "";
    fetchVideos();
  });
});

fetchVideos();
