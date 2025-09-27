document.addEventListener('DOMContentLoaded', function() {
    console.log('=== MODAL DEBUG SCRIPT ===');
    
    // Check if all required elements exist
    const productList = document.getElementById('productList');
    const productModal = document.getElementById('productModal');
    const modalImage = document.getElementById('modalImage');
    const modalName = document.getElementById('modalName');
    const modalPrice = document.getElementById('modalPrice');
    
    console.log('Elements check:');
    console.log('- productList:', !!productList);
    console.log('- productModal:', !!productModal);
    console.log('- modalImage:', !!modalImage);
    console.log('- modalName:', !!modalName);
    console.log('- modalPrice:', !!modalPrice);
    
    if (!productList) {
        console.error('❌ Product list not found!');
        return;
    }
    
    if (!productModal) {
        console.error('❌ Product modal not found!');
        return;
    }
    
    // Check product cards
    const productCards = document.querySelectorAll('.product-card');
    console.log(`Found ${productCards.length} product cards`);
    
    productCards.forEach((card, index) => {
        console.log(`Card ${index}:`, {
            id: card.dataset.id,
            name: card.dataset.name,
            price: card.dataset.price,
            image: card.dataset.image
        });
    });
    
    // Add direct click test
    productCards.forEach((card, index) => {
        card.addEventListener('click', function(e) {
            console.log(`Direct click on card ${index}:`, e.target);
            console.log('Card data:', {
                id: this.dataset.id,
                name: this.dataset.name,
                price: this.dataset.price,
                image: this.dataset.image
            });
            
            // Test modal opening
            testModalOpen(this.dataset.id, this.dataset.name, this.dataset.price, this.dataset.image);
        });
    });
    
    function testModalOpen(id, name, price, image) {
        console.log('🚀 Testing modal open with:', { id, name, price, image });
        
        if (!modalImage || !modalName || !modalPrice) {
            console.error('❌ Modal elements missing');
            return;
        }
        
        modalImage.src = "/images/" + image;
        modalImage.alt = name;
        modalName.textContent = name;
        modalPrice.textContent = price + " บาท";
        
        console.log('✅ Modal content updated');
        
        // Check modal classes before showing
        console.log('Modal classes before:', productModal.className);
        
        productModal.classList.remove("hidden");
        document.body.style.overflow = "hidden";
        
        console.log('Modal classes after:', productModal.className);
        console.log('✅ Modal should be visible now');
        
        // Check computed styles
        const computedStyle = window.getComputedStyle(productModal);
        console.log('Modal computed styles:', {
            display: computedStyle.display,
            visibility: computedStyle.visibility,
            opacity: computedStyle.opacity,
            zIndex: computedStyle.zIndex
        });
    }
    
    // Test modal close
    window.testCloseModal = function() {
        console.log('🔒 Testing modal close');
        productModal.classList.add("hidden");
        document.body.style.overflow = "";
        console.log('✅ Modal closed');
    };
    
    console.log('=== DEBUG SCRIPT LOADED ===');
    console.log('You can now:');
    console.log('1. Click on any product card');
    console.log('2. Call testCloseModal() in console to close');
});