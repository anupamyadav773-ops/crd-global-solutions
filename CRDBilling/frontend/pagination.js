/**
 * CRD Global Solutions - Common Pagination Component
 * Handles client-side & dataset pagination with responsive controls,
 * page size selection, page count summary, and smart ellipses.
 */
function createPagination(options) {
    const {
        pageSizeSelectId = "pageSizeSelect",
        paginationInfoId = "paginationInfo",
        paginationControlsId = "paginationControls",
        defaultPageSize = 10,
        onPageChange = () => {}
    } = options || {};

    let currentPage = 1;
    let pageSize = defaultPageSize;
    let totalItems = 0;

    const pageSizeSelect = document.getElementById(pageSizeSelectId);
    const paginationInfo = document.getElementById(paginationInfoId);
    const paginationControls = document.getElementById(paginationControlsId);

    if (pageSizeSelect) {
        pageSizeSelect.value = String(pageSize);
        pageSizeSelect.addEventListener("change", function () {
            pageSize = parseInt(this.value, 10) || defaultPageSize;
            currentPage = 1;
            onPageChange(currentPage, pageSize);
        });
    }

    function render(newTotalItems, targetPage = null) {
        totalItems = Number(newTotalItems) || 0;
        if (targetPage !== null && targetPage !== undefined) {
            currentPage = targetPage;
        }

        const totalPages = Math.max(1, Math.ceil(totalItems / pageSize));
        if (currentPage > totalPages) currentPage = totalPages;
        if (currentPage < 1) currentPage = 1;

        if (paginationInfo) {
            if (totalItems === 0) {
                paginationInfo.textContent = "Showing 0 of 0 entries";
            } else {
                const startIdx = (currentPage - 1) * pageSize + 1;
                const endIdx = Math.min(totalItems, currentPage * pageSize);
                paginationInfo.textContent = `Showing ${startIdx} to ${endIdx} of ${totalItems} entries`;
            }
        }

        if (!paginationControls) return;
        paginationControls.innerHTML = "";

        if (totalItems === 0) return;

        function createBtn(label, target, disabled, isActive = false, title = "") {
            const btn = document.createElement("button");
            btn.type = "button";
            btn.className = "pagination-btn" + (isActive ? " active" : "");
            btn.innerHTML = label;
            if (title) btn.title = title;
            btn.disabled = !!disabled;
            if (!disabled && !isActive) {
                btn.addEventListener("click", () => {
                    currentPage = target;
                    onPageChange(currentPage, pageSize);
                });
            }
            return btn;
        }

        // First & Prev buttons
        paginationControls.appendChild(createBtn("&laquo;", 1, currentPage <= 1, false, "First Page"));
        paginationControls.appendChild(createBtn("&lsaquo; Prev", currentPage - 1, currentPage <= 1, false, "Previous Page"));

        // Numeric buttons with ellipsis logic
        const maxButtons = 7;
        let pages = [];
        if (totalPages <= maxButtons) {
            for (let i = 1; i <= totalPages; i++) pages.push(i);
        } else {
            pages.push(1);
            if (currentPage > 3) {
                pages.push("...");
            }
            const start = Math.max(2, currentPage - 1);
            const end = Math.min(totalPages - 1, currentPage + 1);
            for (let i = start; i <= end; i++) {
                if (!pages.includes(i)) pages.push(i);
            }
            if (currentPage < totalPages - 2) {
                pages.push("...");
            }
            if (!pages.includes(totalPages)) pages.push(totalPages);
        }

        pages.forEach(p => {
            if (p === "...") {
                const span = document.createElement("span");
                span.className = "pagination-ellipsis";
                span.textContent = "…";
                paginationControls.appendChild(span);
            } else {
                paginationControls.appendChild(createBtn(p, p, false, p === currentPage, `Page ${p}`));
            }
        });

        // Next & Last buttons
        paginationControls.appendChild(createBtn("Next &rsaquo;", currentPage + 1, currentPage >= totalPages, false, "Next Page"));
        paginationControls.appendChild(createBtn("&raquo;", totalPages, currentPage >= totalPages, false, "Last Page"));
    }

    function getSlice(items) {
        if (!Array.isArray(items)) return [];
        const start = (currentPage - 1) * pageSize;
        return items.slice(start, start + pageSize);
    }

    function resetPage() {
        currentPage = 1;
    }

    function setPage(p) {
        currentPage = Math.max(1, parseInt(p, 10) || 1);
    }

    function getCurrentPage() {
        return currentPage;
    }

    function getPageSize() {
        return pageSize;
    }

    return {
        render,
        getSlice,
        resetPage,
        setPage,
        getCurrentPage,
        getPageSize
    };
}
